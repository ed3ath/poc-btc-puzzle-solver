import _ from 'lodash'
import secp256k1 from 'secp256k1'
import bitcoin from 'bitcoinjs-lib'
import cluster from 'cluster'

const numOfWorkers = 8;
const updateEvery = 1; // 30 seconds
const targetAddress = "13zb1hQbWVsc2S7ZTZnP2G4undNNpdh5so";
const random = true;
const keySpace = "20000000000000000:3ffffffffffffffff"

const formatter = Intl.NumberFormat('en', { notation: 'compact' });


function privateKeyToAddress(key) {
    const privateKey = Buffer.from(key.toString(16), 'hex');
    const publicKey = secp256k1.publicKeyCreate(privateKey);
    const publicKeyHash = bitcoin.crypto.hash160(publicKey);
    return bitcoin.payments.p2pkh({ hash: publicKeyHash }).address;
}

function getRandomHexInRange(min, max) {
    const randomNumber = Math.floor(Math.random() * (parseInt(max, 16) - parseInt(min, 16) + 1)) + parseInt(min, 16);
    return randomNumber.toString(16);
}

if (cluster.isPrimary) {
    // Fork workers for each CPU core
    for (let i = 0; i < numOfWorkers; i++) {
        cluster.fork();
    }


    let startTime = new Date();
    let totalKeys = 0;
    let current = ""
    const [start, end] = keySpace.split(":");

    console.log("Start Time:", startTime.toLocaleString());
    console.log("Target address:", targetAddress);
    console.log("Starting Key:", start);
    console.log("Ending Key:", end);
    setInterval(() => {
        const elapsedTime = new Date().getTime() - startTime.getTime();
        const rate = (totalKeys / elapsedTime) * 1000

        const message = [
            "Keys:", formatter.format(totalKeys),
            "/", formatter.format(parseInt(end, 16) - parseInt(start, 16)),
            "| Rate:", formatter.format(Math.trunc(rate)), "keys/s",
            "| ", current
        ].join(" ");
        process.stdout.write("\r" + message);

        // console.log("Total Keys:", totalKeys);
        // console.log("Overall Rate:", Math.trunc(rate).toLocaleString(), "keys/s");
        // console.log("Current:", current);
    }, updateEvery * 1000);

    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died`);
    });

    cluster.on('message', (worker, message) => {
        if (!_.isNil(message.found)) {
            const elapsedTime = new Date().getTime() - startTime.getTime();
            console.log('Private Key Found:', message.privateKey)
            console.log("Total Time:", elapsedTime)
            process.exit(0)
        } else {
            totalKeys += 1
            current = message.current
        }
    })
} else {
    const [start, end] = keySpace.split(":");
    if (random) {
        while (true) {
            const privateKey = _.padStart(getRandomHexInRange(start, end), 64, '0');
            process.send({
                current: privateKey
            })
            if (targetAddress === privateKeyToAddress(privateKey)) {
                process.send({
                    privateKey,
                    found: true
                })
                break;
            }
        }
    } else {
        let current = parseInt(start, 16);
        while (current <= parseInt(end, 16)) {
            const privateKey = _.padStart(current.toString(16), 64, '0');
            process.send({
                current: privateKey
            })
            if (targetAddress === privateKeyToAddress(privateKey)) {
                process.send({
                    privateKey,
                    found: true
                })
                break;
            }
            current++;
        }
    }
}