'use strict';

const fs = require('fs');

const FILE_EXTENSION = '.grd'; // Default file extension, means "grid"

const TEXT_FORMAT_IDENTIFICATION_STRING = 'DSAA'; // Surfer 6 Text Grid File Format

const BINARY_FORMAT_IDENTIFICATION_STRING = 'DSBB'; // Surfer 6 Binary Grid File Format

const TEXT_DELIMITER = ' '; // The fields within ASCII grid files must be space or tab delimited

const TEXT_DELIMITER_SPACE_OR_TAB = / |\t/;

const TEXT_NEWLINE = '\r\n';

const NO_DATA_VALUE_STRING = '1.70141e+038';

function Grid(data, xmin, ymin, xmax, ymax) {
    if (typeof data === 'undefined') {
        this.data = null;
        this.xmin = null;
        this.ymin = null;
        this.xmax = null;
        this.ymax = null;
    }
    else {
        // TODO: validate input
        this.data = data;
        this.xmin = xmin;
        this.ymin = ymin;
        this.xmax = xmax;
        this.ymax = ymax;
    }
}

Grid.prototype.columnCount = function () {
    return this.data === null ? null : this.data[0].length;
}

Grid.prototype.rowCount = function () {
    return this.data === null ? null : this.data.length;
}

Grid.prototype.getMinMax = function () {
    if (this.data === null) {
        throw new Error();
    }

    let min = Number.MAX_VALUE;
    let max = Number.MIN_VALUE;

    for (let row = 0; row < this.rowCount(); row++) {
        for (let column = 0; column < this.columnCount(); column++) {
            let value = this.data[row][column];
            if (value !== null) {
                min = Math.min(min, value);
                max = Math.max(max, value);
            }
        }
    }

    // If all nodes has no values
    if (min === Number.MAX_VALUE && max === Number.MIN_VALUE) {
        min = null;
        max = null;
    }

    return { min, max };
}

Grid.prototype.readSync = function (path) {
    // TODO: format detection and binary format support

    let lines = fs.readFileSync(path).toString().split(TEXT_NEWLINE);
    // TODO: read line by line
    // TODO: check input format
    let arr = [];
    arr = lines[1].trim().split(TEXT_DELIMITER_SPACE_OR_TAB);
    let nx = parseInt(arr[0]);
    let ny = parseInt(arr[1]);
    this.data = new Array();

    arr = lines[2].trim().split(TEXT_DELIMITER_SPACE_OR_TAB);
    this.xmin = parseFloat(arr[0]);
    this.xmax = parseFloat(arr[1]);

    arr = lines[3].trim().split(TEXT_DELIMITER_SPACE_OR_TAB);
    this.ymin = parseFloat(arr[0]);
    this.ymax = parseFloat(arr[1]);

    // TODO: ? skip zmin, zmax

    let row = 0;
    let column = 0;
    for (let i = 5; i < lines.length; i++) {
        if (lines[i].length > 0) {
            arr = lines[i].trim().split(TEXT_DELIMITER_SPACE_OR_TAB);
            // line contains full row or part of row
            for (let j = 0; j < arr.length; j++) {
                if (column === 0) {
                    this.data.push([]);
                }

                let value = arr[j] === NO_DATA_VALUE_STRING ? null : parseFloat(arr[j]);

                this.data[row].push(value);

                column++;

                // Check for next row
                if (column === nx) {
                    row++;
                    column = 0;
                }
            }
        }
    }

    return this;
}

Grid.prototype.writeSync = function (path) {
    // TODO: binary format

    const valueToString = function (value) {
        return value === null ?
            NO_DATA_VALUE_STRING :
            Math.fround(value).toString(); // limiting to 32bit float precision
    }

    let file = fs.openSync(path, 'w');
    let minmax = this.getMinMax();
    // Header - grid size and limits
    fs.writeSync(file, `${TEXT_FORMAT_IDENTIFICATION_STRING}${TEXT_NEWLINE}`);
    fs.writeSync(file, `${this.columnCount()}${TEXT_DELIMITER}${this.rowCount()}${TEXT_NEWLINE}`);
    fs.writeSync(file, `${this.xmin}${TEXT_DELIMITER}${this.xmax}${TEXT_NEWLINE}`);
    fs.writeSync(file, `${this.ymin}${TEXT_DELIMITER}${this.ymax}${TEXT_NEWLINE}`);
    fs.writeSync(file, `${valueToString(minmax.min)}${TEXT_DELIMITER}${valueToString(minmax.max)}${TEXT_NEWLINE}`);

    for (let row = 0; row < this.rowCount(); row++) {
        for (let column = 0; column < this.columnCount(); column++) {
            fs.writeSync(file, valueToString(this.data[row][column]) + TEXT_DELIMITER);
            // TODO: ? limit line length?
        }

        fs.writeSync(file, TEXT_NEWLINE);
        fs.writeSync(file, TEXT_NEWLINE);
    }

    fs.closeSync(file);

    return this;
}

Grid.prototype.blankedNodesCount = function () {
    if (this.data === null) {
        throw new Error();
    }

    let count = 0;
    for (let row = 0; row < this.rowCount(); row++) {
        for (let column = 0; column < this.columnCount(); column++) {
            if (this.data[row][column] === null) {
                count++;
            }
        }
    }

    return count;
}

// TODO: ? more grid statistics functions

module.exports = Grid;
