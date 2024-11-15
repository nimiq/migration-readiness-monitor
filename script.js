// @ts-check

/**
 * @typedef {{
*  hash: string,
*  blockHash: string,
*  blockNumber: number,
*  timestamp: number,
*  confirmations: number,
*  from: string,
*  fromAddress: string,
*  to: string,
*  toAddress: string,
*  value: number,
*  fee: number,
*  data: string | null,
*  proof: string,
*  flags: number,
* }} Transaction
*
* @typedef {{
*  address: string,
*  deposit: number,
*  delegatedStake: number,
*  portion: number,
*  transactions: Transaction[],
* }} Validator
*
* @typedef {{
*  consensus: string,
*  totalStake: number,
*  validators: Validator[],
* }} Info
*/

const $nodeConsensus = /** @type {HTMLElement} */ (document.getElementById('nodeConsensus'));
const $totalStake = /** @type {HTMLElement} */ (document.getElementById('totalStake'));
const $percentageOnline = /** @type {HTMLElement} */ (document.getElementById('percentageOnline'));
const $validatorOnlineTable = /** @type {HTMLElement} */ (document.getElementById('validatorOnlineTable'));
const $readyTableHeader = /** @type {HTMLElement} */ (document.getElementById('readyTableHeader'));
const $percentageReady = /** @type {HTMLElement} */ (document.getElementById('percentageReady'));
const $validatorReadyTable = /** @type {HTMLElement} */ (document.getElementById('validatorReadyTable'));
const $genesisPopularityTable = /** @type {HTMLElement} */ (document.getElementById('genesisPopularityTable'));

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

/** @type {Record<string, number>} */
let genesis_hashes = {};

/** @type {Validator[]} */
let validators = [];

let totalStake = 0;
let percentageOnline = 0;
let percentageReady = 0;

windows.forEach((window) => {
    const el = document.createElement('td');
    el.innerText = `Block window ${window.start} - ${window.end}`;
    $readyTableHeader.appendChild(el)
});

(async () => {
    /**
     * @type {Info}
     */
    const info = await (await fetch('https://api.zeromox.com/api/info')).json();
    $nodeConsensus.innerText = info.consensus;
    validators = info.validators;

    validators.forEach(validator => {
        totalStake += validator.delegatedStake + validator.deposit;
    });

    for await (const validator of validators) {
        validatorOnlineRow(validator);
        validatorReadyRow(validator);
        $percentageOnline.innerText = percentageOnline.toFixed(2);
    };

    $totalStake.innerText = lunaToNim(totalStake);
    const genesis_hashes_list = Object.entries(genesis_hashes)
        .sort(([hash_a, percentage_a], [hash_b, percentage_b]) => percentage_b - percentage_a)
    genesis_hashes_list.forEach(([hash, percentage]) => {
        const row = document.createElement('tr');
        const column = document.createElement('td');
        column.innerHTML = `${hash.substring(0, 50)}... with ${percentage.toFixed(2)}%`;
        row.appendChild(column);
        $genesisPopularityTable.appendChild(row);
    })
    $percentageReady.innerText = genesis_hashes_list[0][1].toFixed(2);

    // Mark the most popular genesis hash cells
    const cells = document.querySelectorAll('.ready-cell');
    cells.forEach(cell => {
        const hash = cell.querySelector('center')?.dataset.genesisHash;
        if (hash === genesis_hashes_list[0][0]) {
            cell.style.backgroundColor = '#88B04B';
        } else if (hash) {
            cell.style.backgroundColor = '#D94432';
        } else {
            cell.style.backgroundColor = 'none';
        }
    })
})()

/**
 * @param {string} address
 */
function shortenAddress(address) {
    const parts = address.split(" ");
    return `${parts[0]}...${parts[parts.length - 1]}`;
}

/**
 * @param {number} amount
 */
function lunaToNim(amount) {
    return prettyNumber(amount / 1e5);
}

/**
 * @param {number} number
 */
function prettyNumber(number) {
    const roundedNumber = Math.round(number);
    return roundedNumber.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

/**
 *
 * @param {Transaction[]} txns
 * @returns {{ online: true, heartbeat: number } | { online: false, heartbeat: null }}
 */
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

/**
 *
 * @param {Transaction[]} txns
 * @param {number} startWindow
 * @param {number} endWindow
 * @returns {Transaction & { data: string } | undefined}
 */
function isValidatorReady(txns, startWindow, endWindow) {
    return /** @type {Transaction & { data: string } | undefined} */ (txns.find((txn) =>
        txn.to === "0000000000000000000000000000000000000000" // Burn address
        && txn.value === 1
        && txn.data && txn.data.length === 64
        && txn.blockNumber >= startWindow
        && txn.blockNumber <= endWindow
    ))
}

/**
 * @param {Validator} validator
 */
function validatorOnlineRow(validator) {
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
    $validatorOnlineTable.appendChild(row);
}

/**
 * @param {Validator} validator
 */
function validatorReadyRow(validator) {
    const row = document.createElement('tr')
    const addressColumn = document.createElement('td');
    addressColumn.innerHTML = `<a href="http://nimiq.watch/#${validator.address}" target="_blank" style="color: #0582CA;">${shortenAddress(validator.address)}</a>&nbsp;(${validator.portion.toFixed(2)}%)`;
    row.appendChild(addressColumn)

    windows.forEach((window, index) => {
        const readyTxn = isValidatorReady(validator.transactions, window.start, window.end);
        const readyCell = document.createElement('td');
        readyCell.classList.add('ready-cell');
        if (!readyTxn) {
            readyCell.innerHTML = `<center style="color: #888">Not ready</center>`;
        } else {
            if (genesis_hashes.hasOwnProperty(readyTxn.data)) {
                genesis_hashes[readyTxn.data] += validator.portion;
            } else {
                genesis_hashes[readyTxn.data] = validator.portion;
            }

            readyCell.innerHTML = `
            <center data-genesis-hash="${readyTxn.data}">
                <a href="http://nimiq.watch/#${readyTxn.hash}" target="_blank">
                    <span style="color: black">
                        ${readyTxn.data.substring(0, 4)}...${readyTxn.data.substring(60, 64)}
                    </span>
                </>
            </center>
            `;
        }
        row.appendChild(readyCell);
    })

    $validatorReadyTable.appendChild(row)
}
