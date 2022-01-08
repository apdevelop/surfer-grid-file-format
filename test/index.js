'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const Grid = require('..');

// TODO: tests for Surfer 6 <-> Surfer 7 format conversion with data/precision loss

describe('creating', function () {

    it('simple 4x3 grid', function () {
        let grid = new Grid([
            [0, 1, 1, 2],
            [2, 3, 5, 1],
            [1, 3, 2, 1]],
            0, 0, 30, 20);

        assert.strictEqual(grid.format, null);
        assert.strictEqual(grid.rowCount(), 3);
        assert.strictEqual(grid.columnCount(), 4);
        assert.strictEqual(grid.blankedNodesCount(), 0);
        assert.strictEqual(grid.data[1][2], 5);
        assert.strictEqual(grid.xmin, 0);
        assert.strictEqual(grid.ymin, 0);
        assert.strictEqual(grid.xmax, 30);
        assert.strictEqual(grid.ymax, 20);
        assert.strictEqual(grid.blankValue, 1.70141e+038);
    });

    it('no data 2x2 grid', function () {
        let grid = new Grid([
            [null, null],
            [null, null]],
            0, 0, 10, 10);

        assert.strictEqual(grid.format, null);
        assert.strictEqual(grid.rowCount(), 2);
        assert.strictEqual(grid.columnCount(), 2);
        assert.strictEqual(grid.blankedNodesCount(), 4);
        assert.strictEqual(grid.minimum(), null);
        assert.strictEqual(grid.maximum(), null);
    });

    it('zero 2x2 grid', function () {
        let grid = new Grid([
            [0, 0],
            [0, 0]],
            0, 0, 10, 10);

        assert.strictEqual(grid.rowCount(), 2);
        assert.strictEqual(grid.columnCount(), 2);
        assert.strictEqual(grid.blankedNodesCount(), 0);
        assert.strictEqual(grid.minimum(), 0);
        assert.strictEqual(grid.maximum(), 0);
    });
});

describe('read write text files', function () {

    it('read text file', function (done) {
        const checkGrid = function (grid) {
            assert.strictEqual(grid.format, Grid.TEXT);
            assert.strictEqual(grid.rowCount(), 3);
            assert.strictEqual(grid.columnCount(), 4);
            assert.strictEqual(grid.blankedNodesCount(), 1);
            assert.strictEqual(grid.data[0][0], 0);
            assert.strictEqual(grid.data[2][2], null);
        };

        let grid = new Grid().readSync(path.join(__dirname, 'sample-1-surfer6.grd'));
        checkGrid(grid);

        new Grid().read(path.join(__dirname, 'sample-1-surfer6.grd'), function (error, result) {
            assert.strictEqual(error, null);
            assert.strictEqual(typeof result, 'object');
            checkGrid(result);
            done();
        });
    });

    it('read write text file', function (done) {
        const checkGrid = function (grid) {
            assert.strictEqual(grid.blankedNodesCount(), 2);
            assert.strictEqual(grid.data[0][0], null);
            assert.strictEqual(grid.data[1][2], 5);
        }

        let grid = new Grid();
        grid.readSync(path.join(__dirname, 'sample-1-surfer10.grd'));

        assert.strictEqual(grid.rowCount(), 3);
        assert.strictEqual(grid.columnCount(), 4);
        assert.strictEqual(grid.blankedNodesCount(), 1);

        grid.data[0][0] = null;
        grid.data[1][2] = 5;

        let temp = path.join(os.tmpdir(), 'surfer-grid-file-format-test-out.grd');
        grid.writeSync(temp); // Default is text format

        checkGrid(new Grid().readSync(temp));

        new Grid().read(temp, function (error, result) {
            assert.strictEqual(error, null);
            assert.strictEqual(typeof result, 'object');
            checkGrid(result);
            fs.unlinkSync(temp);
            done();
        });
    });
});

describe('read write binary files', function () {

    it('read binary 2x2 zero grid file', function () {
        let grid = new Grid().readSync(path.join(__dirname, 'minimal-2x2-zeros.binary.grd'));

        assert.strictEqual(grid.format, Grid.BINARY);
        assert.strictEqual(grid.rowCount(), 2);
        assert.strictEqual(grid.columnCount(), 2);
        assert.strictEqual(grid.blankedNodesCount(), 0);
        assert.strictEqual(grid.minimum(), 0);
        assert.strictEqual(grid.maximum(), 0);
    });

    it('read binary file', function (done) {
        const checkGrid = function (grid) {
            assert.strictEqual(grid.format, Grid.BINARY);
            assert.strictEqual(grid.xmin, 0);
            assert.strictEqual(grid.ymin, 0);
            assert.strictEqual(grid.xmax, 30);
            assert.strictEqual(grid.ymax, 20);
            assert.strictEqual(grid.rowCount(), 3);
            assert.strictEqual(grid.columnCount(), 4);
            assert.strictEqual(grid.blankedNodesCount(), 1);
            assert.strictEqual(grid.data[0][0], 0);
            assert.strictEqual(grid.data[2][2], null);
        };

        let grid = new Grid().readSync(path.join(__dirname, 'sample1.binary.grd'));
        checkGrid(grid);

        new Grid().read(path.join(__dirname, 'sample1.binary.grd'), function (error, result) {
            assert.strictEqual(error, null);
            assert.strictEqual(typeof result, 'object');
            checkGrid(result);
            done();
        });
    });

    it('read write binary file', function (done) {
        const compareFiles = function (source, temp) {
            let data1 = fs.readFileSync(source);
            let data2 = fs.readFileSync(temp);
            assert.strictEqual(data1.compare(data2), 0);
        }

        let source = path.join(__dirname, 'sample1.binary.grd');
        let grid = new Grid().readSync(source);
        let temp = path.join(os.tmpdir(), 'surfer-grid-file-format-test-out.grd');
        grid.writeSync(temp, Grid.BINARY);

        compareFiles(source, temp);

        grid.write(temp, Grid.BINARY, function (error, result) {
            assert.strictEqual(error, null);
            assert.strictEqual(typeof result, 'object');
            compareFiles(source, temp);
            fs.unlinkSync(temp);
            done();
        });
    });

    it('write read no data 2x2 grid', function (done) {
        const checkGrid = function (grid) {
            assert.strictEqual(grid.rowCount(), 2);
            assert.strictEqual(grid.columnCount(), 2);
            assert.strictEqual(grid.blankedNodesCount(), 4);
            assert.strictEqual(grid.minimum(), null);
            assert.strictEqual(grid.maximum(), null);
        };

        let grid = new Grid([
            [null, null],
            [null, null]],
            0, 0, 10, 10);

        let temp = path.join(os.tmpdir(), 'surfer-grid-file-format-test-out.grd');
        grid.writeSync(temp, Grid.BINARY);

        grid = new Grid().readSync(temp);
        checkGrid(grid);

        grid.write(temp, Grid.BINARY, function (error, result) {
            assert.strictEqual(error, null);
            assert.strictEqual(typeof result, 'object');
            grid = new Grid().readSync(temp);
            checkGrid(grid);
            fs.unlinkSync(temp);
            done();
        });
    });

    it('read surfer6 sample text file', function () {
        let source = path.join(__dirname, 'HELENS2.text.grd');
        if (fs.existsSync(source)) {
            let grid = new Grid().readSync(source);

            assert.strictEqual(grid.xmin, 557820);
            assert.strictEqual(grid.ymin, 5108010);
            assert.strictEqual(grid.xmax, 567600);
            assert.strictEqual(grid.ymax, 5121960);
            assert.strictEqual(grid.rowCount(), 466);
            assert.strictEqual(grid.columnCount(), 327);
            assert.strictEqual(grid.blankedNodesCount(), 3497);

            assert.strictEqual(grid.minimum(), 684);
            assert.strictEqual(grid.maximum(), 2547);

            assert.strictEqual(grid.data[0][0], null);
            assert.strictEqual(grid.data[272][160], 1864);

            // For manual comparing
            ////let temp = path.join(os.tmpdir(), 'surfer-grid-file-format-test-out.grd');
            ////grid.writeSync(temp, Grid.TEXT);
            ////fs.unlinkSync(temp);
        }
    });

});

describe('read write surfer7 format files', function () {

    it('read surfer7 2x2 zero grid file', function () {
        let grid = new Grid().readSync(path.join(__dirname, 'minimal-2x2-zeros.surfer7.grd'));

        assert.strictEqual(grid.format, Grid.SURFER7);
        assert.strictEqual(grid.xmin, 0);
        assert.strictEqual(grid.ymin, 0);
        assert.strictEqual(grid.xmax, 10);
        assert.strictEqual(grid.ymax, 10);
        assert.strictEqual(grid.rowCount(), 2);
        assert.strictEqual(grid.columnCount(), 2);
        assert.strictEqual(grid.blankedNodesCount(), 0);
        assert.strictEqual(grid.minimum(), 0);
        assert.strictEqual(grid.maximum(), 0);
        assert.strictEqual(grid.blankValue, 1.70141e+038);
    });

    it('read write surfer7 file', function () {
        let source = path.join(__dirname, 'sample1.surfer7.grd');
        let grid = new Grid().readSync(source);

        assert.strictEqual(grid.format, Grid.SURFER7);
        assert.strictEqual(grid.xmin, 0);
        assert.strictEqual(grid.ymin, 0);
        assert.strictEqual(grid.xmax, 30);
        assert.strictEqual(grid.ymax, 20);
        assert.strictEqual(grid.rowCount(), 3);
        assert.strictEqual(grid.columnCount(), 4);
        assert.strictEqual(grid.blankedNodesCount(), 1);
        assert.strictEqual(grid.data[0][0], 0);
        assert.strictEqual(grid.data[2][2], null);
        assert.strictEqual(grid.blankValue, 1.70141e+038);

        let temp = path.join(os.tmpdir(), 'surfer-grid-file-format-test-out.grd');
        grid.writeSync(temp, Grid.SURFER7);

        let data1 = fs.readFileSync(source);
        let data2 = fs.readFileSync(temp);
        assert.strictEqual(data1.compare(data2), 0);

        fs.unlinkSync(temp);
    });
});

describe('read surfer sample files', function () {
    const SURFER_SAMPLES_PATH = 'c:\\Program Files\\Golden Software\\Surfer 10\\Samples';

    it('Conifer.grd', function () {
        let source = path.join(SURFER_SAMPLES_PATH, 'Conifer.grd');
        if (fs.existsSync(source)) {
            let grid = new Grid().readSync(source);

            assert.strictEqual(grid.xmin, 467790);
            assert.strictEqual(grid.ymin, 4372140);
            assert.strictEqual(grid.xmax, 478440);
            assert.strictEqual(grid.ymax, 4385820);
            assert.strictEqual(grid.rowCount(), 77);
            assert.strictEqual(grid.columnCount(), 72);
            assert.strictEqual(grid.blankedNodesCount(), 33);
            assert.strictEqual(grid.minimum(), 2140);
            assert.strictEqual(grid.maximum(), 3044);
            assert.strictEqual(grid.data[0][0], 2548);
            assert.strictEqual(grid.data[34][36], 2458);
        }
    });

    it('Concentration.grd', function () {
        let source = path.join(SURFER_SAMPLES_PATH, 'Concentration.grd');
        if (fs.existsSync(source)) {
            let grid = new Grid().readSync(source);

            assert.strictEqual(grid.xmin, 486300);
            assert.strictEqual(grid.ymin, 4406800);
            assert.strictEqual(grid.xmax, 487800);
            assert.strictEqual(grid.ymax, 4408800);
            assert.strictEqual(grid.rowCount(), 100);
            assert.strictEqual(grid.columnCount(), 80);
            assert.strictEqual(grid.blankedNodesCount(), 3938);
            ////assert.strictEqual(grid.minimum(), 2.00040303533);
            ////assert.strictEqual(grid.maximum(), 49.207404518);
            assert.strictEqual(grid.data[0][0], null);
            ////assert.strictEqual(grid.data[44][36], 49.207404518);
        }
    });

    it('Helens2.grd', function () {
        let source = path.join(SURFER_SAMPLES_PATH, 'Helens2.grd'); // Sample file from Surfer 6
        if (fs.existsSync(source)) {
            let grid = new Grid().readSync(source);

            assert.strictEqual(grid.xmin, 557820);
            assert.strictEqual(grid.ymin, 5108010);
            assert.strictEqual(grid.xmax, 567600);
            assert.strictEqual(grid.ymax, 5121960);
            assert.strictEqual(grid.rowCount(), 466);
            assert.strictEqual(grid.columnCount(), 327);
            assert.strictEqual(grid.blankedNodesCount(), 3497);

            assert.strictEqual(grid.minimum(), 684);
            assert.strictEqual(grid.maximum(), 2547);

            assert.strictEqual(grid.data[0][0], null);
            assert.strictEqual(grid.data[272][160], 1864);

            let temp = path.join(os.tmpdir(), 'surfer-grid-file-format-test-out.grd');
            grid.writeSync(temp, Grid.BINARY);

            let data1 = fs.readFileSync(source);
            let data2 = fs.readFileSync(temp);
            assert.strictEqual(data1.compare(data2), 0);

            fs.unlinkSync(temp);
        }
    });

    it('Telluride.grd', function () {
        let source = path.join(SURFER_SAMPLES_PATH, 'Telluride.grd');
        if (fs.existsSync(source)) {
            let grid = new Grid().readSync(source);

            assert.strictEqual(grid.xmin, 247140);
            assert.strictEqual(grid.ymin, 4195320);
            assert.strictEqual(grid.xmax, 258510);
            assert.strictEqual(grid.ymax, 4209510);
            assert.strictEqual(grid.rotation, 0);
            assert.strictEqual(grid.rowCount(), 474);
            assert.strictEqual(grid.columnCount(), 380);
            assert.strictEqual(grid.blankedNodesCount(), 10602);
            assert.strictEqual(grid.minimum(), 2630);
            assert.strictEqual(grid.maximum(), 4209);
            assert.strictEqual(grid.data[0][0], null);
        }
    });
});
