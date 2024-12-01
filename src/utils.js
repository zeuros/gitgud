const {spawn} = require('child_process')
const {URL} = require('url')

const onAuth = async (url) => {
    console.log('onAuth')
    const {protocol, host} = new URL(url)
    return new Promise((resolve, reject) => {
        const output = []
        const process = spawn('git', ['credential', 'fill'])
        process.on('close', (code) => {
            if (code) return reject(code)
            const {username, password} = output.join('\n').split('\n').reduce((acc, line) => {
                if (line.startsWith('username') || line.startsWith('password')) {
                    const [key, val] = line.split('=')
                    acc[key] = val
                }
                return acc
            }, {})
            resolve({username, password})
        })
        process.stdout.on('data', (data) => output.push(data.toString().trim()))
        process.stdin.write(`protocol=${protocol.slice(0, -1)}\nhost=${host}\n\n`)
    })
};


module.exports = {
    onAuth,
};