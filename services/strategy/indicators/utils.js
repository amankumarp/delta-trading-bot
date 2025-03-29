/**
 * 📌 Check if series1 crosses above series2 (Cross Up)
 * @param {number[]} series1 - First series (e.g., price or indicator)
 * @param {number[]} series2 - Second series (e.g., moving average)
 * @returns {boolean[]} - Array of boolean values (true if crossUp occurred)
 */
function crossUp(series1, series2) {
    if (series1.length !== series2.length) {
        throw new Error("Arrays must have the same length");
    }

    let crosses = new Array(series1.length).fill(false);

    for (let i = 1; i < series1.length; i++) {
        if (series1[i - 1] <= series2[i - 1] && series1[i] > series2[i]) {
            crosses[i] = true;
        }
    }

    return crosses;
}

/**
 * 📌 Check if series1 crosses below series2 (Cross Down)
 * @param {number[]} series1 - First series (e.g., price or indicator)
 * @param {number[]} series2 - Second series (e.g., moving average)
 * @returns {boolean[]} - Array of boolean values (true if crossDown occurred)
 */
function crossDown(series1, series2) {
    if (series1.length !== series2.length) {
        throw new Error("Arrays must have the same length");
    }

    let crosses = new Array(series1.length).fill(false);

    for (let i = 1; i < series1.length; i++) {
        if (series1[i - 1] >= series2[i - 1] && series1[i] < series2[i]) {
            crosses[i] = true;
        }
    }

    return crosses;
}

module.exports = { crossUp, crossDown };