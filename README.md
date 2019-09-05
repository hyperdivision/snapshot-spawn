# snapshot-spawn

Spawn a process from a storage snapshot and continue to snapshot at regular intervals

```
npm install @hyperdivision/snapshot-spawn
```

## Usage

``` js
const Spawn = require('@hyperdivision/snapshot-spawn')
const Snapshot = require('@hyperdivision/s3-snapshot')
const S3 = require('s3-storage')

const s3 = new S3('fs://fake-s3')
const snapshot = new Snapshot('data', 'data-snapshot.tar', s3)

const s = new Spawn('node', ['-e', `
  let tick = 0

  try {
    tick = Number(fs.readFileSync('data/tick'), 'utf-8') || 0
  } catch (_) {}

  setInterval(function () {
    console.log('tick', tick++)
    if (!fs.existsSync('data')) fs.mkdirSync('data')
    fs.writeFileSync('data/tick', '' + tick)
  }, 1000)
`], {
  snapshot,
  interval: 3000
})

s.on('stdout', data => process.stdout.write(data))
s.on('stderr', data => process.stderr.write(data))

s.on('download', () => console.log('Downloading a snapshot'))
s.on('snapshot', () => console.log('Taking a snapshot'))
```

## API

#### `s = new Spawn(cmd, args, options)`

Create a new instance.

* `cmd` is the command you want to spawn.
* `args` is the array of arguments you want to pass.

Options include

``` js
{
  snapshot: <s3-snapshot-instance>, // required
  interval: ..., // how often should it snapshot in ms? defaults to 24h
  rollbacks: 0 // how many rollback to previous versions should be attempted?
}
```

#### `s.kill(signal)`

Kill the process with a signal. Waits for a pending snapshot to finish.

#### `s.pid`

The PID of the running process.

#### `s.on('stdout', data)`

Emitted when there data from stdout.

#### `s.on('stderr', data)`

Emitted when there data from stderr.

#### `s.on('error', err)`

Emitted when a critical error happens.

#### `s.on('exit', code)`

Emitted when the process exits fully.

#### `s.on('download')`

Emitted when a snapshot is being downloaded.

#### `s.on('snapshot')`

Emitted when a snapshot is being performed.
Before a snapshot happens your process will be killed with SIGTERM.

#### `s.on('spawn')`

Emitted when a process is spawned.

#### `s.on('rollback')`

Emitted when a rollback is attempted.

#### `Spawn.ROLLBACK_CODE`

Exit the process with this code (114) to attempt a rollback.
