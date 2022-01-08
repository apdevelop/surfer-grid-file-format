'use strict';

const fs = require('fs');

const FILE_EXTENSION = '.grd'; // Default file extension, means "grid"

const TEXT_FORMAT_IDENTIFICATION_STRING = 'DSAA'; // Surfer 6 Text Grid File Format

const BINARY_FORMAT_IDENTIFICATION_STRING = 'DSBB'; // Surfer 6 Binary Grid File Format

const SURFER7_FORMAT_IDENTIFICATION_STRING = 'DSRB'; // Surfer 7 Grid File Format

const TEXT_DELIMITER = ' '; // The fields within text grid files must be space or tab delimited

const TEXT_DELIMITER_SPACE_OR_TAB = / |\t/;

const TEXT_NEWLINE = '\r\n';

const NO_DATA_VALUE_STRING = '1.70141e+038';

const NO_DATA_VALUE_HEX = 0x7effffee; // NO DATA special value in 32bit floating point format

const NO_DATA_VALUE_DOUBLE_RAW = '2cd019bdfdffdf47'; // NO DATA special value in 64bit floating point format

const SIZE_LONG = 4; // 32 bit signed integer

const SIZE_FLOAT = 4; // 32 bit single precision floating point value

const SIZE_DOUBLE = 8; // 64 bit double precision floating point value

const SURFER7_SECTION_HEADER = 0x42525344;

const SURFER7_SECTION_GRID = 0x44495247;

const SURFER7_SECTION_DATA = 0x41544144;

const SURFER7_SECTION_FAULT_INFO = 0x49544c46;

/** 
 * Creates and returns grid object.
 * @param data Grid data matrix - 2D array of Z values.
 * @param xmin X coordinate of the lower left corner of the grid.
 * @param ymin Y coordinate of the lower left corner of the grid.
 * @param xmax X coordinate of the upper right corner of the grid.
 * @param ymax Y coordinate of the upper right corner of the grid.
 * @param rotation Rotation angle of the grid.
 * */
function Grid(data, xmin, ymin, xmax, ymax, rotation) {
    if (typeof data === 'undefined') {
        this.data = null;
        this.xmin = null;
        this.ymin = null;
        this.xmax = null;
        this.ymax = null;
        this.rotation = null;
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
        this.rotation = (typeof rotation === 'undefined') ? 0 : rotation;
    }

    this.format = null;
    this.blankValue = Buffer.from(NO_DATA_VALUE_DOUBLE_RAW, 'hex').readDoubleLE(0);
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
 * Reads grid asynchronously from specified file.
 * @param path Path to the grid file.
 * @param callback Callback function with error and result arguments.
 * */
Grid.prototype.read = function (path, callback) { // TODO: ? static function
    const FORMAT_SIZE = 4;

    var self = this;
    fs.open(path, 'r', function (error, file) {
        if (error) throw error;
        let formatBuffer = Buffer.alloc(FORMAT_SIZE);
        fs.read(file, formatBuffer, 0, formatBuffer.length, 0, function (error, bytesRead) {
            if (error) throw error;

            self.format = formatBuffer.toString('latin1', 0, formatBuffer.length);

            if (self.format === TEXT_FORMAT_IDENTIFICATION_STRING) {
                fs.stat(path, function (error, stats) {
                    if (error) throw error;

                    let dataBuffer = Buffer.alloc(stats.size - FORMAT_SIZE);
                    fs.read(file, dataBuffer, 0, dataBuffer.length, FORMAT_SIZE, function (error, bytesRead) {
                        if (error) throw error;

                        let lines = dataBuffer.toString('latin1').split(TEXT_NEWLINE);

                        // TODO: read line by line
                        // TODO: check input format
                        let arr = [];
                        arr = lines[1].trim().split(TEXT_DELIMITER_SPACE_OR_TAB);
                        let nx = parseInt(arr[0]);
                        let ny = parseInt(arr[1]);
                        self.data = new Array();

                        arr = lines[2].trim().split(TEXT_DELIMITER_SPACE_OR_TAB);
                        self.xmin = parseFloat(arr[0]);
                        self.xmax = parseFloat(arr[1]);

                        arr = lines[3].trim().split(TEXT_DELIMITER_SPACE_OR_TAB);
                        self.ymin = parseFloat(arr[0]);
                        self.ymax = parseFloat(arr[1]);
                        // TODO: ? skip zmin, zmax
                        self.rotation = 0;

                        let row = 0;
                        let column = 0;
                        for (let i = 5; i < lines.length; i++) {
                            if (lines[i].length > 0) {
                                arr = lines[i].trim().split(TEXT_DELIMITER_SPACE_OR_TAB);
                                // line contains full row or part of row
                                for (let j = 0; j < arr.length; j++) {
                                    if (column === 0) {
                                        self.data.push([]);
                                    }

                                    let value = arr[j] === NO_DATA_VALUE_STRING ? null : parseFloat(arr[j]);

                                    self.data[row].push(value);

                                    column++;

                                    // Check for next row
                                    if (column === nx) {
                                        row++;
                                        column = 0;
                                    }
                                }
                            }
                        }

                        fs.close(file, function (error) {
                            if (error) throw error;
                            callback(null, self); // Read file completed
                        });
                    });
                })
            }
            else if (self.format === BINARY_FORMAT_IDENTIFICATION_STRING) {
                const HeaderSize = 2 * 2 + 6 * 8;

                // TODO: validate input data
                let headerBuffer = Buffer.alloc(HeaderSize);
                fs.read(file, headerBuffer, 0, HeaderSize, FORMAT_SIZE, function (error, bytesRead) {
                    if (error) throw error;

                    let header = readBinaryHeader(headerBuffer);
                    let columnCount = header.columnCount;
                    let rowCount = header.rowCount;
                    self.xmin = header.xmin;
                    self.xmax = header.xmax;
                    self.ymin = header.ymin;
                    self.ymax = header.ymax;
                    // TODO: ? skip zmin, zmax
                    self.rotation = 0;

                    self.data = new Array();

                    let row = 0;
                    let position = FORMAT_SIZE + HeaderSize;
                    let rowBuffer = Buffer.alloc(columnCount * SIZE_FLOAT);

                    let readRow = function () {
                        fs.read(file, rowBuffer, 0, rowBuffer.length, position, function (error, bytesRead, buffer) {
                            if (error) throw error;

                            if (bytesRead !== buffer.length) {
                                fs.close(file, function (error) {
                                    if (error) throw error;
                                    throw new Error(`Error reading row ${row + 1}/${rowCount}, unexpected end of file`);
                                });
                            }

                            self.data.push(readFloatRow(buffer));
                            position += buffer.length;
                            row++;

                            if (row < rowCount) {
                                readRow();
                            }
                            else {
                                fs.close(file, function (error) {
                                    if (error) throw error;
                                    callback(null, self); // Read file completed
                                });
                            }
                        });
                    }

                    readRow();
                });
            }
            else if (this.format === SURFER7_FORMAT_IDENTIFICATION_STRING) {
                // TODO: ! SURFER7 Async reading
                throw new Error(`Async reading is not supported for ${SURFER7_FORMAT_IDENTIFICATION_STRING} format`);
            }
            else {
                throw new Error(`Unknown file format with "${self.format}" header`);
            }

        });
    });
}

/** 
 * Reads grid from specified file, returns grid object. 
 * @param path Path to the grid file.
 * */
Grid.prototype.readSync = function (path) {
    const FORMAT_SIZE = 4;

    let file = fs.openSync(path, 'r');
    let formatBuffer = Buffer.alloc(FORMAT_SIZE);
    fs.readSync(file, formatBuffer, 0, formatBuffer.length, 0);
    this.format = formatBuffer.toString('latin1', 0, formatBuffer.length);

    if (this.format === TEXT_FORMAT_IDENTIFICATION_STRING) {
        let fileSize = fs.statSync(path).size;
        let dataBuffer = Buffer.alloc(fileSize - FORMAT_SIZE);
        fs.readSync(file, dataBuffer, 0, dataBuffer.length, FORMAT_SIZE);
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

        this.rotation = 0;

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
    else if (this.format === BINARY_FORMAT_IDENTIFICATION_STRING) {
        const HeaderSize = 2 * 2 + 6 * 8;

        // TODO: validate input data

        let headerBuffer = Buffer.alloc(HeaderSize);
        fs.readSync(file, headerBuffer, 0, HeaderSize, FORMAT_SIZE);

        let header = readBinaryHeader(headerBuffer);
        let columnCount = header.columnCount;
        let rowCount = header.rowCount;
        this.xmin = header.xmin;
        this.xmax = header.xmax;
        this.ymin = header.ymin;
        this.ymax = header.ymax;
        // TODO: ? skip zmin, zmax
        this.rotation = 0;

        this.data = new Array();

        let position = FORMAT_SIZE + HeaderSize;
        let rowBuffer = Buffer.alloc(columnCount * SIZE_FLOAT);

        for (let row = 0; row < rowCount; row++) {
            let bytesRead = fs.readSync(file, rowBuffer, 0, rowBuffer.length, position);
            if (bytesRead !== rowBuffer.length) {
                fs.closeSync(file);
                throw new Error(`Error reading row ${row + 1}/${rowCount}, unexpected end of file`);
            }

            this.data.push(readFloatRow(rowBuffer));
            position += rowBuffer.length;
        }

        fs.closeSync(file);
    }
    else if (this.format === SURFER7_FORMAT_IDENTIFICATION_STRING) {
        let position = FORMAT_SIZE;

        // Header Section
        let sizeBuffer = Buffer.alloc(SIZE_LONG);
        fs.readSync(file, sizeBuffer, 0, sizeBuffer.length, position);
        let headerSectionSize = sizeBuffer.readInt32LE(0);
        position += sizeBuffer.length;

        let headerSectionBuffer = Buffer.alloc(headerSectionSize);
        fs.readSync(file, headerSectionBuffer, 0, headerSectionBuffer.length, position);
        let version = headerSectionBuffer.readInt32LE(0); // 1 or 2
        position += headerSectionBuffer.length; // TODO: use Version

        let tagBuffer = Buffer.alloc(SIZE_LONG * 2); // Tag structure

        let rowCount = 0;
        let columnCount = 0;

        for (; ;) {
            // Each section is preceded by a tag structure
            fs.readSync(file, tagBuffer, 0, tagBuffer.length, position);
            position += tagBuffer.length;

            let sectionId = tagBuffer.readUInt32LE(0);
            let sectionSize = tagBuffer.readInt32LE(SIZE_LONG);
            if (sectionId === SURFER7_SECTION_GRID) {
                // Grid Section
                let gridSectionBuffer = Buffer.alloc(sectionSize);
                fs.readSync(file, gridSectionBuffer, 0, gridSectionBuffer.length, position);
                position += sectionSize;

                let offset = 0;
                rowCount = gridSectionBuffer.readInt32LE(offset);
                offset += SIZE_LONG;
                columnCount = gridSectionBuffer.readInt32LE(offset);
                offset += SIZE_LONG;
                this.xmin = gridSectionBuffer.readDoubleLE(offset);
                offset += SIZE_DOUBLE;
                this.ymin = gridSectionBuffer.readDoubleLE(offset);
                offset += SIZE_DOUBLE;
                let xSize = gridSectionBuffer.readDoubleLE(offset);
                offset += SIZE_DOUBLE;
                let ySize = gridSectionBuffer.readDoubleLE(offset);
                offset += SIZE_DOUBLE;

                this.xmax = this.xmin + (columnCount - 1) * xSize;
                this.ymax = this.ymin + (rowCount - 1) * ySize;

                // TODO: ? skip zmin, zmax
                offset += SIZE_DOUBLE;
                offset += SIZE_DOUBLE;

                this.rotation = gridSectionBuffer.readDoubleLE(offset);
                offset += SIZE_DOUBLE;

                this.blankValue = gridSectionBuffer.readDoubleLE(offset);
            }
            else if (sectionId === SURFER7_SECTION_DATA) {
                // Data Section
                // TODO: check that prev section is Grid
                this.data = new Array();
                let rowBuffer = Buffer.alloc(columnCount * SIZE_DOUBLE);

                for (let row = 0; row < rowCount; row++) {
                    let bytesRead = fs.readSync(file, rowBuffer, 0, rowBuffer.length, position);
                    if (bytesRead !== columnCount * SIZE_DOUBLE) {
                        fs.closeSync(file);
                        throw new Error(`Error reading row ${row}/${rowCount}, unexpected end of file`);
                    }

                    this.data.push([]);
                    for (let column = 0; column < columnCount; column++) {
                        let v = rowBuffer.readDoubleLE(column * SIZE_DOUBLE);
                        let value = v === this.blankValue ? null : v;
                        this.data[row].push(value);
                    }

                    position += columnCount * SIZE_DOUBLE;
                }

                //position += sectionSize;
            }
            else if (sectionId === SURFER7_SECTION_FAULT_INFO) {
                // Skipping Fault Info Section

                position += sectionSize;
            }
            else {
                throw new Error(`Unknown section Id=${sectionId.toString(16)}`);
            }

            if (position === fs.statSync(path).size) {
                break;
            }
        }

        return this;
    }
    else {
        throw new Error(`Unknown file format with "${this.format}" header`);
    }

    return this;
}

const readBinaryHeader = function (headerBuffer) {
    return {
        columnCount: headerBuffer.readInt16LE(0),
        rowCount: headerBuffer.readInt16LE(2),
        xmin: headerBuffer.readDoubleLE(4),
        xmax: headerBuffer.readDoubleLE(12),
        ymin: headerBuffer.readDoubleLE(20),
        ymax: headerBuffer.readDoubleLE(28)
    };
}

const readFloatRow = function (rowBuffer) {
    let data = [];
    let columnCount = rowBuffer.length / SIZE_FLOAT;
    for (let column = 0; column < columnCount; column++) {
        // Avoiding rounding errors when compare
        let value = rowBuffer.readUInt32LE(column * SIZE_FLOAT) === NO_DATA_VALUE_HEX ?
            null :
            rowBuffer.readFloatLE(column * SIZE_FLOAT);

        data.push(value);
    }

    return data;
}

/** 
 * Writes grid asynchronously to specified file, returns grid object.
 * @param path Path to the output file.
 * @param format Output file format, defaults to text format.
 * */
Grid.prototype.write = function (path, format, callback) {
    format = format ? format : TEXT_FORMAT_IDENTIFICATION_STRING;
    let minmax = this.getMinMax();

    var self = this;
    fs.open(path, 'w', function (error, file) {
        if (error) throw error;

        if (format === TEXT_FORMAT_IDENTIFICATION_STRING) {
            let header = createTextHeader(self, minmax);
            fs.write(file, header, function (error) {
                if (error) throw error;

                let row = 0;
                let writeRow = function () {
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

                    fs.write(file, rowLine + TEXT_NEWLINE + TEXT_NEWLINE, function () {
                        if (error) throw error;

                        row++;
                        if (row < self.rowCount()) {
                            writeRow();
                        }
                        else {
                            fs.close(file, function (error) {
                                if (error) throw error;
                                callback(null, self); // Write file completed
                            });
                        }
                    });
                }

                writeRow();
            });
        }
        else if (format === BINARY_FORMAT_IDENTIFICATION_STRING) {
            let header = createBinaryHeader(self, minmax);
            fs.write(file, header, 0, header.length, 0, function (error) {
                if (error) throw error;

                let row = 0;
                let position = header.length;
                let rowBuffer = Buffer.alloc(self.columnCount() * SIZE_FLOAT);

                let writeRow = function () {
                    for (let column = 0; column < self.columnCount(); column++) {
                        if (self.data[row][column] === null) {
                            rowBuffer.writeUInt32LE(NO_DATA_VALUE_HEX, column * SIZE_FLOAT);
                        }
                        else {
                            rowBuffer.writeFloatLE(Math.fround(self.data[row][column]), column * SIZE_FLOAT);
                        }
                    }

                    fs.write(file, rowBuffer, 0, rowBuffer.length, position, function (error) {
                        if (error) throw error;

                        position += rowBuffer.length;
                        row++;
                        if (row < self.rowCount()) {
                            writeRow();
                        }
                        else {
                            fs.close(file, function (error) {
                                if (error) throw error;
                                callback(null, self); // Write file completed
                            });
                        }
                    });
                }

                writeRow();
            });
        }
        else if (format === SURFER7_FORMAT_IDENTIFICATION_STRING) {
            // TODO: ! SURFER7 Async writing
            throw new Error(`Async writing is not supported for ${SURFER7_FORMAT_IDENTIFICATION_STRING} format`);
        }
        else {
            fs.closeSync(file);
            throw new Error(`Unsupported ${format} format`);
        }
    });
}

/** 
 * Writes grid to specified file, returns grid object. 
 * @param path Path to the output file.
 * @param format Output file format, defaults to text format.
 * */
Grid.prototype.writeSync = function (path, format) {
    format = format ? format : TEXT_FORMAT_IDENTIFICATION_STRING;
    let minmax = this.getMinMax();
    let file = fs.openSync(path, 'w');
    if (format === TEXT_FORMAT_IDENTIFICATION_STRING) {
        fs.writeSync(file, createTextHeader(this, minmax));

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
        let headerBuffer = createBinaryHeader(this, minmax);
        fs.writeSync(file, headerBuffer, 0, headerBuffer.length, 0);

        let position = headerBuffer.length;
        let rowBuffer = Buffer.alloc(this.columnCount() * SIZE_FLOAT);
        for (let row = 0; row < this.rowCount(); row++) {
            for (let column = 0; column < this.columnCount(); column++) {
                if (this.data[row][column] === null) {
                    rowBuffer.writeUInt32LE(NO_DATA_VALUE_HEX, column * SIZE_FLOAT);
                }
                else {
                    rowBuffer.writeFloatLE(Math.fround(this.data[row][column]), column * SIZE_FLOAT);
                }
            }

            fs.writeSync(file, rowBuffer, 0, rowBuffer.length, position);
            position += rowBuffer.length;
        }
    }
    else if (format === SURFER7_FORMAT_IDENTIFICATION_STRING) {
        let position = 0;
        let offset = 0;

        let headerBuffer = Buffer.alloc(2 * SIZE_LONG + SIZE_LONG);
        headerBuffer.writeInt32LE(SURFER7_SECTION_HEADER, offset);
        offset += SIZE_LONG;
        headerBuffer.writeInt32LE(headerBuffer.length - 2 * SIZE_LONG, offset);
        offset += SIZE_LONG;
        headerBuffer.writeInt32LE(2, offset); // TODO: Version support
        fs.writeSync(file, headerBuffer, 0, headerBuffer.length, position);
        position += headerBuffer.length;

        offset = 0;
        let gridBuffer = Buffer.alloc(2 * SIZE_LONG + 2 * SIZE_LONG + 8 * SIZE_DOUBLE);
        gridBuffer.writeInt32LE(SURFER7_SECTION_GRID, offset);
        offset += SIZE_LONG;
        gridBuffer.writeInt32LE(gridBuffer.length - 2 * SIZE_LONG, offset);
        offset += SIZE_LONG;

        gridBuffer.writeInt32LE(this.rowCount(), offset);
        offset += SIZE_LONG;
        gridBuffer.writeInt32LE(this.columnCount(), offset);
        offset += SIZE_LONG;

        gridBuffer.writeDoubleLE(this.xmin, offset);
        offset += SIZE_DOUBLE;
        gridBuffer.writeDoubleLE(this.ymin, offset);
        offset += SIZE_DOUBLE;

        gridBuffer.writeDoubleLE((this.xmax - this.xmin) / (this.columnCount() - 1), offset);
        offset += SIZE_DOUBLE;
        gridBuffer.writeDoubleLE((this.ymax - this.ymin) / (this.rowCount() - 1), offset);
        offset += SIZE_DOUBLE;

        if (minmax.min === null) {
            gridBuffer.writeDoubleLE(this.blankValue, offset);
        }
        else {
            gridBuffer.writeDoubleLE(minmax.min, offset);
        }

        offset += SIZE_DOUBLE;

        if (minmax.max === null) {
            gridBuffer.writeDoubleLE(this.blankValue, offset);
        }
        else {
            gridBuffer.writeDoubleLE(minmax.max, offset);
        }

        offset += SIZE_DOUBLE;

        gridBuffer.writeDoubleLE(this.rotation, offset);
        offset += SIZE_DOUBLE;

        gridBuffer.writeDoubleLE(this.blankValue, offset);

        fs.writeSync(file, gridBuffer, 0, gridBuffer.length, position);
        position += gridBuffer.length;

        // Data section
        offset = 0;
        let dataBuffer = Buffer.alloc(2 * SIZE_LONG);
        dataBuffer.writeInt32LE(SURFER7_SECTION_DATA, offset);
        offset += SIZE_LONG;
        dataBuffer.writeInt32LE(this.rowCount() * this.columnCount() * SIZE_DOUBLE, offset);
        offset += SIZE_LONG;
        fs.writeSync(file, dataBuffer, 0, dataBuffer.length, position);
        position += dataBuffer.length;

        let rowBuffer = Buffer.alloc(this.columnCount() * SIZE_DOUBLE);
        for (let row = 0; row < this.rowCount(); row++) {
            for (let column = 0; column < this.columnCount(); column++) {
                if (this.data[row][column] === null) {
                    rowBuffer.writeDoubleLE(this.blankValue, column * SIZE_DOUBLE);
                }
                else {
                    rowBuffer.writeDoubleLE(this.data[row][column], column * SIZE_DOUBLE);
                }
            }

            fs.writeSync(file, rowBuffer, 0, rowBuffer.length, position);
            position += rowBuffer.length;
        }

        // TODO: Fault Info Section
    }
    else {
        fs.closeSync(file);
        throw new Error(`Unsupported ${format} format`);
    }

    fs.closeSync(file);

    return this;
}

const valueToString = function (value) {
    return value === null ?
        NO_DATA_VALUE_STRING :
        Math.fround(value).toString(); // limiting to 32bit float precision
}

const createTextHeader = function (grid, minmax) {
    return `${TEXT_FORMAT_IDENTIFICATION_STRING}${TEXT_NEWLINE}` +
        `${grid.columnCount()}${TEXT_DELIMITER}${grid.rowCount()}${TEXT_NEWLINE}` +
        `${grid.xmin}${TEXT_DELIMITER}${grid.xmax}${TEXT_NEWLINE}` +
        `${grid.ymin}${TEXT_DELIMITER}${grid.ymax}${TEXT_NEWLINE}` +
        `${valueToString(minmax.min)}${TEXT_DELIMITER}${valueToString(minmax.max)}${TEXT_NEWLINE}`;
}

const createBinaryHeader = function (grid, minmax) {
    const FORMAT_SIZE = 4;
    const HeaderSize = FORMAT_SIZE + 2 * 2 + 6 * SIZE_DOUBLE;

    let headerBuffer = Buffer.alloc(HeaderSize);
    headerBuffer.write(BINARY_FORMAT_IDENTIFICATION_STRING, 0, 'latin1');
    headerBuffer.writeInt16LE(grid.columnCount(), 0 + FORMAT_SIZE);
    headerBuffer.writeInt16LE(grid.rowCount(), 2 + FORMAT_SIZE);
    headerBuffer.writeDoubleLE(grid.xmin, 4 + FORMAT_SIZE);
    headerBuffer.writeDoubleLE(grid.xmax, 12 + FORMAT_SIZE);
    headerBuffer.writeDoubleLE(grid.ymin, 20 + FORMAT_SIZE);
    headerBuffer.writeDoubleLE(grid.ymax, 28 + FORMAT_SIZE); // TODO: use offset variable
    if (minmax.min === null) {
        headerBuffer.writeUInt32LE(NO_DATA_VALUE_HEX, 36 + FORMAT_SIZE);
    }
    else {
        headerBuffer.writeDoubleLE(minmax.min, 36 + FORMAT_SIZE);
    }

    if (minmax.max === null) {
        headerBuffer.writeUInt32LE(NO_DATA_VALUE_HEX, 44 + FORMAT_SIZE);
    }
    else {
        headerBuffer.writeDoubleLE(minmax.max, 44 + FORMAT_SIZE);
    }

    return headerBuffer;
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

/** Constant for grid.writeSync(), means Surfer 6 text grid file format. */
Grid.TEXT = TEXT_FORMAT_IDENTIFICATION_STRING;

/** Constant for grid.writeSync(), means Surfer 6 binary grid file format. */
Grid.BINARY = BINARY_FORMAT_IDENTIFICATION_STRING;

/** Constant for grid.writeSync(), means Surfer 7 grid file format. */
Grid.SURFER7 = SURFER7_FORMAT_IDENTIFICATION_STRING;

module.exports = Grid;
