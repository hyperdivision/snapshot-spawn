const { spawn } = require('child_process')
const { EventEmitter } = require('events')

const ROLLBACK_CODE = 114

class SnapshotSpawn extends EventEmitter {
  constructor (cmd, args, opts) {
    super()

    this.cmd = cmd
    this.args = args
    this.snapshot = opts.snapshot
    this.snapshotting = false
    this.process = null
    this.exited = false
    this.killed = false
    this.exitCode = 0
    this.timeout = null
    this.interval = opts.interval || 24 * 3600 * 1000
    this.rollbacks = opts.rollbacks || 0
    this.attemptedRollbacks = 0

    if (!this.snapshot) {
      throw new Error('options.snapshot is required')
    }

    this._download()
  }

  kill (signal) {
    this.killed = true
    if (this.process) process.kill(this.process.pid, signal)
  }

  get pid () {
    return this.process ? this.process.pid : -1
  }

  _exit (code) {
    if (this.exited) return
    this.exited = true
    if (this.timeout) clearTimeout(this.timeout)
    this.emit('exit', code)
  }

  _download () {
    this.snapshot.exists((err, exists) => {
      if (err) return this.emit('error', err)
      if (!exists) return this._respawn()

      this.emit('download')
      this.snapshot.download((err) => {
        if (err) return this.emit('error', err)

        this.emit('downloaded')
        this.attemptedRollbacks = 0
        this._respawn()
      })
    })
  }

  _respawn () {
    if (this.exited || this.killed) return
    if (this.process) throw new Error('Cannot respawn whilst running')

    this.process = spawn(this.cmd, this.args)
    this.emit('spawn', this.process)

    this.process.stdout.on('data', this.emit.bind(this, 'stdout'))
    this.process.stderr.on('data', this.emit.bind(this, 'stderr'))
    this.process.on('error', (err) => {
      if (this.snapshotting) return

      if (this.timeout) clearTimeout(this.timeout)
      this.timeout = null

      this.emit('error', err)
    })

    this.process.on('exit', (code) => {
      if (this.timeout) clearTimeout(this.timeout)
      this.timeout = null

      this.exitCode = code
      this.process = null

      // check if the process wants to trigger a rollback
      if (code === ROLLBACK_CODE && this.rollbacks > this.attemptedRollbacks++) {
        this.emit('rollback')
        this.snapshot.rollback((err, rolledback) => {
          if (err) return this.emit('error', err)
          if (rolledback) return this._download()
          this._exit(code)
        })
        return
      }

      if (!this.snapshotting) return this._exit(code)

      this.emit('snapshot')
      this.snapshot.snapshot((err) => {
        if (err) return this.emit('error', err)
        if (this.killed) return this._exit(this.exitCode)
        this.snapshotting = false
        this._respawn()
      })
    })

    this.timeout = setTimeout(() => {
      if (this.killed || this.exited) return
      this.emit('snapshotting')
      this.snapshotting = true
      process.kill(this.process.pid)
    }, this.interval)
  }
}

SnapshotSpawn.ROLLBACK_CODE = ROLLBACK_CODE

module.exports = SnapshotSpawn
