// @ts-check

const nodeConsensusEl = document.getElementById('nodeConsensus');
const totalStakeEl = document.getElementById('totalStake');
const percentageOnlineEl = document.getElementById('percentageOnline');
const percentageReadyEl = document.getElementById('percentageReady');
const windows = [
    {
        start: 3456000,
        end: 3457440
    },
    {
        start: 3457440,
        end: 3458880
    },
    {
        start: 3458880,
        end: 3460320
    },
    {
        start: 3460320,
        end: 3461760
    },
    {
        start: 3461760,
        end: 3463200
    },
    {
        start: 3463200,
        end: 3464640
    }
];
let genesis_hashes = {};
let validators = [];
let totalStake = 0;
let percentageOnline = 0;
let percentageReady = 0;

windows.forEach((window) => {
    const el = document.createElement('td');
    el.innerText = `Block window ${window.start} - ${window.end}`;
    readyTableHeader.appendChild(el)
});

(async () => {
    const info = await (await fetch('https://api.zeromox.com/api/info')).json();
    nodeConsensusEl.innerText = info.consensus;
    validators = info.validators;

    validators.forEach(validator => {
        totalStake += validator.delegatedStake + validator.deposit;
    });

    for await (const validator of validators) {
        validatorOnlineColumn(validator);
        validatorReadyColumn(validator);
        percentageOnlineEl.innerText = percentageOnline.toFixed(2);
    };

    totalStakeEl.innerText = lunaToNim(totalStake);
    const genesis_hashes_list = Object.entries(genesis_hashes).sort((a, b) => {
        b[1] - a[1]
    })
    genesis_hashes_list.forEach(([hash, percentage]) => {
        const row = document.createElement('tr');
        const column = document.createElement('td');
        column.innerHTML = `${hash.substring(0, 50)}... with ${percentage}%`;
        row.appendChild(column);
        genesisPopularityTable.appendChild(row);
    })
    percentageReadyEl.innerText = genesis_hashes_list[0][1].toFixed(2);
})()

function shortenAddress(address) {
    const parts = address.split(" ");
    return `${parts[0]}...${parts[parts.length - 1]}`;
}

function lunaToNim(amount) {
    return prettyNumber(amount / 1e5);
}

function prettyNumber(number) {
    const roundedNumber = Math.round(number);
    return roundedNumber.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

function isValidatorOnline(txns) {
    txns = txns
        .filter((txn) =>
            txn.to === "0000000000000000000000000000000000000000" // Burn address
            && txn.blockNumber >= 3449700 // Filter out fake positives. Fixed in PR 3035
            && txn.value === 1
            && txn.data === "6f6e6c696e65") // "online"

    if (txns.length > 0) {
        return { online: true, heartbeat: txns[0].timestamp * 1000 }
    }

    return { online: false, heartbeat: null }
}

function isValidatorReady(txns, startWindow, endWindow) {
    let readyTxn = txns.find((txn) =>
        txn.to === "0000000000000000000000000000000000000000" // Burn address
        && txn.value === 1
        && txn.data.length === 128
        && txn.blockNumber >= startWindow
        && txn.blockNumber <= endWindow
    )

    return readyTxn;
}

function validatorOnlineColumn(validator) {
    const { online, heartbeat } = isValidatorOnline(validator.transactions);

    const row = document.createElement('tr');
    const column = document.createElement('td');
    column.innerHTML = `
    <a href="http://nimiq.watch/#${validator.address}" target="_blank" style="color: #0582CA;">${shortenAddress(validator.address)}</a>
    with a stake of ${lunaToNim(validator.deposit + validator.delegatedStake)} NIM (${validator.portion.toFixed(2)}%)
    `
    if (online) {
        column.innerHTML += `is <b><span style="color: #41A38E">online</span></b>. Last heartbeat: ${new Date(heartbeat).toLocaleString()}`
        percentageOnline += validator.portion
    } else {
        column.innerHTML += `is <b><span style="color: #CC3047">offline</span></b>`
    }

    row.appendChild(column);
    validatorOnlineTable.appendChild(row);
}

function validatorReadyColumn(validator) {
    const row = document.createElement('tr')
    const addressColumn = document.createElement('td');
    addressColumn.innerHTML = `<a href="http://nimiq.watch/#${validator.address}" target="_blank" style="color:blue;">${shortenAddress(validator.address)}</a> (${validator.portion.toFixed(2)}%)`;
    row.appendChild(addressColumn)

    windows.forEach((window, index) => {
        const readyTxn = isValidatorReady(validator.transactions, window.start, window.end);
        const readyColumn = document.createElement('td');
        if (!readyTxn) {
            readyColumn.innerHTML = `<center>Not ready</center>`;
        } else {
            if (genesis_hashes.hasOwnProperty(readyTxn.data)) {
                genesis_hashes[readyTxn.data] += validator.portion;
            } else {
                genesis_hashes[readyTxn.data] = validator.portion;
            }

            readyColumn.innerHTML = `
            <center>
                <a href="http://nimiq.watch/#${readyTxn.hash}" target="_blank">
                    <span style="color: black">
                        Ready: ${readyTxn.data.substring(0, 10)}...
                    </span>
                </>
            </center>
            `;
        }
        row.appendChild(readyColumn);
    })

    validatorReadyTable.appendChild(row)
}
