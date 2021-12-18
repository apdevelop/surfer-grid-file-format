'use strict';

const fs = require('fs');

const FILE_EXTENSION = '.grd'; // Default file extension, means "grid"

const TEXT_FORMAT_IDENTIFICATION_STRING = 'DSAA'; // Surfer 6 Text Grid File Format

const BINARY_FORMAT_IDENTIFICATION_STRING = 'DSBB'; // Surfer 6 Binary Grid File Format

const TEXT_DELIMITER = ' '; // The fields within ASCII grid files must be space or tab delimited

const TEXT_DELIMITER_SPACE_OR_TAB = / |\t/;

const TEXT_NEWLINE = '\r\n';

const NO_DATA_VALUE_STRING = '1.70141e+038';

const NO_DATA_VALUE_HEX = 0x7effffee; // NO DATA special value in 32bit floating point format

/** Creates and returns grid object. */
function Grid(data, xmin, ymin, xmax, ymax) {
    if (typeof data === 'undefined') {
        this.data = null;
        this.xmin = null;
        this.ymin = null;
        this.xmax = null;
        this.ymax = null;
    }
    else {
        // TODO: validate input with messages
        // Surfer 10: The acceptable size is 2 to 32767.
        if (data.length < 2 ||
            data[0].length < 2 ||
            data.length > 32767 ||
            data[0].length > 32767) {
            throw new Error('The acceptable grid size is 2 to 32767.');
        }

        // TODO: ? internal representation: single dimensional array?
        this.data = data;
        this.xmin = xmin;
        this.ymin = ymin;
        this.xmax = xmax;
        this.ymax = ymax;
    }
}

/** Returns number of grid columns. */
Grid.prototype.columnCount = function () {
    return this.data === null ? null : this.data[0].length;
}

/** Returns number of grid rows. */
Grid.prototype.rowCount = function () {
    return this.data === null ? null : this.data.length;
}

Grid.prototype.getMinMax = function () {
    if (this.data === null) {
        throw new Error();
    }

    let isAllEmpty = true;
    let min = +Number.MAX_VALUE;
    let max = -Number.MAX_VALUE;

    for (let row = 0; row < this.rowCount(); row++) {
        for (let column = 0; column < this.columnCount(); column++) {
            let value = this.data[row][column];
            if (value !== null) {
                min = Math.min(min, value);
                max = Math.max(max, value);
                isAllEmpty = false;
            }
        }
    }

    // If all nodes has no values
    if (isAllEmpty) {
        min = null;
        max = null;
    }

    return { min, max };
}

/** 
 * Reads grid from specified file, returns grid object. 
 * @param path Path to the grid file.
 * */
Grid.prototype.readSync = function (path) {
    const FormatSize = 4;

    let file = fs.openSync(path, 'r');
    let formatBuffer = Buffer.alloc(FormatSize);
    fs.readSync(file, formatBuffer, 0, FormatSize, 0);
    let format = formatBuffer.toString('latin1', 0, FormatSize);

    if (format === TEXT_FORMAT_IDENTIFICATION_STRING) {
        let fileSize = fs.statSync(path).size;
        let dataBuffer = Buffer.alloc(fileSize - FormatSize);
        fs.readSync(file, dataBuffer, 0, dataBuffer.length, FormatSize);
        let lines = dataBuffer.toString('latin1').split(TEXT_NEWLINE);

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

        fs.closeSync(file);
    }
    else if (format === BINARY_FORMAT_IDENTIFICATION_STRING) {
        const FLOAT_SIZE = 4;
        const HeaderSize = 2 * 2 + 6 * 8;

        let headerBuffer = Buffer.alloc(HeaderSize);
        fs.readSync(file, headerBuffer, 0, HeaderSize, FormatSize);

        let columnCount = headerBuffer.readInt16LE(0);
        let rowCount = headerBuffer.readInt16LE(2);
        this.data = new Array();

        this.xmin = headerBuffer.readDoubleLE(4);
        this.xmax = headerBuffer.readDoubleLE(12);
        this.ymin = headerBuffer.readDoubleLE(20);
        this.ymax = headerBuffer.readDoubleLE(28);

        // TODO: ? skip zmin, zmax
        let position = FormatSize + HeaderSize;
        let rowBuffer = Buffer.alloc(columnCount * FLOAT_SIZE);

        // TODO: validate input data
        for (let row = 0; row < rowCount; row++) {
            let num = fs.readSync(file, rowBuffer, 0, columnCount * FLOAT_SIZE, position);
            if (num !== columnCount * FLOAT_SIZE) {
                fs.closeSync(file);
                throw new Error(`Error reading row ${row}/${rowCount}, unexpected end of file`);
            }

            this.data.push([]);
            for (let column = 0; column < columnCount; column++) {
                // Avoiding rounding errors when compare
                let value = rowBuffer.readUInt32LE(column * FLOAT_SIZE) === NO_DATA_VALUE_HEX ?
                    null :
                    rowBuffer.readFloatLE(column * FLOAT_SIZE);

                this.data[row].push(value);
            }

            position += columnCount * FLOAT_SIZE;
        }

        fs.closeSync(file);
    }
    else {
        throw new Error('Unknown file format ' + format);
    }

    return this;
}

/** 
 * Writes grid to specified file, returns grid object. 
 * @param path Path to the output file.
 * @param format Output file format, defaults to text format.
 * */
Grid.prototype.writeSync = function (path, format) {
    format = format ? format : TEXT_FORMAT_IDENTIFICATION_STRING;

    let file = fs.openSync(path, 'w');
    let minmax = this.getMinMax();

    if (format === TEXT_FORMAT_IDENTIFICATION_STRING) {
        const valueToString = function (value) {
            return value === null ?
                NO_DATA_VALUE_STRING :
                Math.fround(value).toString(); // limiting to 32bit float precision
        }

        // Header - grid size and limits
        fs.writeSync(file, `${TEXT_FORMAT_IDENTIFICATION_STRING}${TEXT_NEWLINE}`);
        fs.writeSync(file, `${this.columnCount()}${TEXT_DELIMITER}${this.rowCount()}${TEXT_NEWLINE}`);
        fs.writeSync(file, `${this.xmin}${TEXT_DELIMITER}${this.xmax}${TEXT_NEWLINE}`);
        fs.writeSync(file, `${this.ymin}${TEXT_DELIMITER}${this.ymax}${TEXT_NEWLINE}`);
        fs.writeSync(file, `${valueToString(minmax.min)}${TEXT_DELIMITER}${valueToString(minmax.max)}${TEXT_NEWLINE}`);

        for (let row = 0; row < this.rowCount(); row++) {
            let rowLine = '';
            for (let column = 0; column < this.columnCount(); column++) {
                // Limiting line length - additional newline after 10 values
                if (column > 0 && column % 10 === 0) {
                    rowLine += TEXT_NEWLINE;
                }

                // Optimize writing to file a bit
                rowLine += valueToString(this.data[row][column]);
                rowLine += TEXT_DELIMITER;
            }

            fs.writeSync(file, rowLine + TEXT_NEWLINE + TEXT_NEWLINE);
        }
    }
    else if (format === BINARY_FORMAT_IDENTIFICATION_STRING) {
        const FORMAT_SIZE = 4;
        const FLOAT_SIZE = 4;
        const DOUBLE_SIZE = 8;
        const HeaderSize = 2 * 2 + 6 * DOUBLE_SIZE;

        let headerBuffer = Buffer.alloc(HeaderSize);
        headerBuffer.writeInt16LE(this.columnCount(), 0);
        headerBuffer.writeInt16LE(this.rowCount(), 2);
        headerBuffer.writeDoubleLE(this.xmin, 4);
        headerBuffer.writeDoubleLE(this.xmax, 12);
        headerBuffer.writeDoubleLE(this.ymin, 20);
        headerBuffer.writeDoubleLE(this.ymax, 28);
        if (minmax.min === null) {
            headerBuffer.writeUInt32LE(NO_DATA_VALUE_HEX, 36);
        }
        else {
            headerBuffer.writeDoubleLE(minmax.min, 36);
        }

        if (minmax.max === null) {
            headerBuffer.writeUInt32LE(NO_DATA_VALUE_HEX, 44);
        }
        else {
            headerBuffer.writeDoubleLE(minmax.max, 44);
        }

        fs.writeSync(file, BINARY_FORMAT_IDENTIFICATION_STRING, 0, 'latin1');
        fs.writeSync(file, headerBuffer, 0, headerBuffer.length, 4);

        let position = FORMAT_SIZE + HeaderSize;
        let rowBuffer = Buffer.alloc(this.columnCount() * FLOAT_SIZE);
        for (let row = 0; row < this.rowCount(); row++) {
            for (let column = 0; column < this.columnCount(); column++) {
                if (this.data[row][column] === null) {
                    rowBuffer.writeUInt32LE(NO_DATA_VALUE_HEX, column * FLOAT_SIZE);
                }
                else {
                    rowBuffer.writeFloatLE(Math.fround(this.data[row][column]), column * FLOAT_SIZE);
                }
            }

            fs.writeSync(file, rowBuffer, 0, rowBuffer.length, position);
            position += this.columnCount() * FLOAT_SIZE;
        }
    }
    else {
        fs.closeSync(file);
        throw new Error(`Unsupported ${format} format`);
    }

    fs.closeSync(file);

    return this;
}

/** Returns number of empty (blanked, no data) nodes in grid. */
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

/** Returns minimum value among grid nodes. */
Grid.prototype.minimum = function () {
    return this.getMinMax().min;
}

/** Returns maximum value among grid nodes. */
Grid.prototype.maximum = function () {
    return this.getMinMax().max;
}

// TODO: ? more grid statistics functions

/** Constant for grid.writeSync(), means Surfer 6 text (ASCII) grid file format. */
Grid.TEXT = TEXT_FORMAT_IDENTIFICATION_STRING;

/** Constant for grid.writeSync(), means Surfer 6 binary grid file format. */
Grid.BINARY = BINARY_FORMAT_IDENTIFICATION_STRING;

module.exports = Grid;
