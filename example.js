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
