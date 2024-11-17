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

const $onlineSection = /** @type {HTMLElement} */ (document.querySelector('section.online'));
const $percentageOnline = /** @type {HTMLElement} */ (document.getElementById('percentageOnline'));
const $validatorOnlineTable = /** @type {HTMLElement} */ (document.getElementById('validatorOnlineTable'));

const $readySection = /** @type {HTMLElement} */ (document.querySelector('section.ready'));
const $readyTableHeader = /** @type {HTMLElement} */ (document.getElementById('readyTableHeader'));
const $percentageReady = /** @type {HTMLElement} */ (document.getElementById('percentageReady'));
const $validatorReadyTable = /** @type {HTMLElement} */ (document.getElementById('validatorReadyTable'));

const $popularitySection = /** @type {HTMLElement} */ (document.querySelector('section.popularity'));
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

/**
 * Stores the genesis hashes and their popularity per window start block
 * @type {Record<number, Record<string, number>>}
 */
let genesis_hashes = {};

/** @type {Validator[]} */
let validators = [];

let totalStake = 0;
let percentageOnline = 0;
let percentageReady = 0;

windows.forEach((window) => {
    const el = document.createElement('td');
    el.innerText = `#${window.start} - #${window.end}`;
    $readyTableHeader.appendChild(el)
});

async function getData() {
    // Reset all working variables
    genesis_hashes = {};
    validators = [];

    totalStake = 0;
    percentageOnline = 0;
    percentageReady = 0;

    /**
     * @type {Info}
     */
    const info = await (await fetch('https://api.zeromox.com/api/info')).json();

    // Reset tables
    $validatorOnlineTable.innerHTML = '';
    $validatorReadyTable.innerHTML = '';
    $genesisPopularityTable.innerHTML = '';

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
    const hashes_list_by_window = (Object.entries(genesis_hashes)
        .map(([window_start, genesis_hashes]) => {
            const genesis_hashes_list = Object.entries(genesis_hashes)
                .sort(([hash_a, percentage_a], [hash_b, percentage_b]) => percentage_b - percentage_a);
            return {
                start: window_start,
                hashes: genesis_hashes_list,
            };
        }));

    // Populate popularity table
    const latest_hashes = hashes_list_by_window.at(-1);
    if (latest_hashes) {
        latest_hashes.hashes.forEach(([hash, percentage]) => {
            const row = document.createElement('tr');
            const column = document.createElement('td');
            column.innerHTML = `${hash.substring(0, 50)}... with ${percentage.toFixed(2)}%`;
            row.appendChild(column);
            $genesisPopularityTable.appendChild(row);
        })
        $percentageReady.innerText = latest_hashes.hashes[0][1].toFixed(2) || '0';
    }

    // Mark the most popular genesis hash cells per window
    for (const { start, hashes } of hashes_list_by_window) {
        /** @type {NodeListOf<HTMLElement>} */
        const cells = document.querySelectorAll('.ready-cell[data-window-start="' + start + '"]');
        cells.forEach(cell => {
            const hash = cell.querySelector('center')?.dataset.genesisHash;
            if (hash === hashes[0][0]) {
                cell.style.backgroundColor = '#88B04B';
            } else if (hash) {
                cell.style.backgroundColor = '#D94432';
            } else {
                cell.style.backgroundColor = 'none';
            }
        });
    }
}

getData();
setInterval(getData, 60e3); // Update every minute

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
            && txn.blockNumber >= 3451680 // Only consider online transaction 3 windows before first transition block
            && txn.value === 1
            && txn.data.startsWith("6f6e6c696e65")) // "online"

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
        const hoursSinceHeartbeat = (Date.now() - heartbeat) / 1e3 / 60 / 60;
        let color = '#41A38E'; // green
        if (hoursSinceHeartbeat >= 3) color = '#FC8702'; // orange
        if (hoursSinceHeartbeat >= 6) color = '#CC3047'; // red

        const ago = /** @type {{format: (date: number|Date|string) => string}} */ (timeago).format(heartbeat);
        column.innerHTML += `was <b><span style="color: ${color}">online ${ago}</span></b> <small>${new Date(heartbeat).toLocaleString()}</small>`
        if (hoursSinceHeartbeat < 3) {
            percentageOnline += validator.portion
        }
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
        readyCell.dataset.windowStart = window.start.toString();
        if (!readyTxn) {
            readyCell.innerHTML = `<center style="color: #888">Not ready</center>`;
        } else {
            $onlineSection.style.display = 'none';
            const window_genesis_hashes = genesis_hashes[window.start] || {};
            if (window_genesis_hashes.hasOwnProperty(readyTxn.data)) {
                window_genesis_hashes[readyTxn.data] += validator.portion;
            } else {
                window_genesis_hashes[readyTxn.data] = validator.portion;
            }
            genesis_hashes[window.start] = window_genesis_hashes;

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
