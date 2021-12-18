'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const Grid = require('..');

describe('creating', function () {

    it('simple 4x3 grid', function () {
        let grid = new Grid([
            [0, 1, 1, 2],
            [2, 3, 5, 1],
            [1, 3, 2, 1]],
            0, 0, 30, 20);

        assert.equal(grid.rowCount(), 3);
        assert.equal(grid.columnCount(), 4);
        assert.equal(grid.blankedNodesCount(), 0);

        assert.equal(grid.data[1][2], 5);

        assert.equal(grid.xmin, 0);
        assert.equal(grid.ymin, 0);
        assert.equal(grid.xmax, 30);
        assert.equal(grid.ymax, 20);
    });

    it('no data 2x2 grid', function () {
        let grid = new Grid([
            [null, null],
            [null, null]],
            0, 0, 10, 10);

        assert.equal(grid.rowCount(), 2);
        assert.equal(grid.columnCount(), 2);
        assert.equal(grid.blankedNodesCount(), 4);
        assert.equal(grid.minimum(), null);
        assert.equal(grid.maximum(), null);
    });

    it('zero 2x2 grid', function () {
        let grid = new Grid([
            [0, 0],
            [0, 0]],
            0, 0, 10, 10);

        assert.equal(grid.rowCount(), 2);
        assert.equal(grid.columnCount(), 2);
        assert.equal(grid.blankedNodesCount(), 0);
        assert.equal(grid.minimum(), 0);
        assert.equal(grid.maximum(), 0);
    });
});

describe('read write text files', function () {

    it('read text file', function () {
        let grid = new Grid().readSync(path.join(__dirname, 'sample-1-surfer6.grd'));

        assert.equal(grid.rowCount(), 3);
        assert.equal(grid.columnCount(), 4);
        assert.equal(grid.blankedNodesCount(), 1);
        assert.equal(grid.data[0][0], 0);
        assert.equal(grid.data[2][2], null);
    });

    it('read write text file', function () {
        let grid = new Grid();
        grid.readSync(path.join(__dirname, 'sample-1-surfer10.grd'));

        assert.equal(grid.rowCount(), 3);
        assert.equal(grid.columnCount(), 4);
        assert.equal(grid.blankedNodesCount(), 1);

        grid.data[0][0] = null;
        grid.data[1][2] = 5;

        let temp = path.join(os.tmpdir(), 'surfer-grid-file-format-test-out.grd');
        grid.writeSync(temp); // Default is text format

        let grid2 = new Grid().readSync(temp);
        assert.equal(grid2.blankedNodesCount(), 2);
        assert.equal(grid.data[0][0], null);
        assert.equal(grid.data[1][2], 5);

        fs.unlinkSync(temp);
    });

});

describe('read write binary files', function () {

    it('read binary file', function () {
        let grid = new Grid().readSync(path.join(__dirname, 'sample-1-binary.grd'));

        assert.equal(grid.xmin, 0);
        assert.equal(grid.ymin, 0);
        assert.equal(grid.xmax, 30);
        assert.equal(grid.ymax, 20);
        assert.equal(grid.rowCount(), 3);
        assert.equal(grid.columnCount(), 4);
        assert.equal(grid.blankedNodesCount(), 1);
        assert.equal(grid.data[0][0], 0);
        assert.equal(grid.data[2][2], null);
    });

    it('read write binary file', function () {
        let source = path.join(__dirname, 'sample-1-binary.grd');
        let grid = new Grid().readSync(source);
        let temp = path.join(os.tmpdir(), 'surfer-grid-file-format-test-out.grd');
        grid.writeSync(temp, Grid.BINARY);

        let data1 = fs.readFileSync(source);
        let data2 = fs.readFileSync(temp);
        assert.equal(data1.compare(data2), 0);

        fs.unlinkSync(temp);
    });

    it('write read no data 2x2 grid', function () {
        let grid = new Grid([
            [null, null],
            [null, null]],
            0, 0, 10, 10);

        let temp = path.join(os.tmpdir(), 'surfer-grid-file-format-test-out.grd');
        grid.writeSync(temp, Grid.BINARY);

        grid = new Grid().readSync(temp);

        assert.equal(grid.rowCount(), 2);
        assert.equal(grid.columnCount(), 2);
        assert.equal(grid.blankedNodesCount(), 4);
        assert.equal(grid.minimum(), null);
        assert.equal(grid.maximum(), null);

        fs.unlinkSync(temp);
    });

    it('read surfer6 sample binary file', function () {
        let source = path.join(__dirname, 'HELENS2.GRD'); // Sample file from Surfer 6
        if (fs.existsSync(source)) {
            let grid = new Grid().readSync(source);

            assert.equal(grid.xmin, 557820);
            assert.equal(grid.ymin, 5108010);
            assert.equal(grid.xmax, 567600);
            assert.equal(grid.ymax, 5121960);
            assert.equal(grid.rowCount(), 466);
            assert.equal(grid.columnCount(), 327);
            assert.equal(grid.blankedNodesCount(), 3497);

            assert.equal(grid.minimum(), 684);
            assert.equal(grid.maximum(), 2547);

            assert.equal(grid.data[0][0], null);
            assert.equal(grid.data[272][160], 1864);

            let temp = path.join(os.tmpdir(), 'surfer-grid-file-format-test-out.grd');
            grid.writeSync(temp, Grid.BINARY);

            let data1 = fs.readFileSync(source);
            let data2 = fs.readFileSync(temp);
            assert.equal(data1.compare(data2), 0);

            fs.unlinkSync(temp);
        }
    });

    it('read surfer6 sample text file', function () {
        let source = path.join(__dirname, 'HELENS2.text.grd'); // Sample file from Surfer 6
        if (fs.existsSync(source)) {
            let grid = new Grid().readSync(source);

            assert.equal(grid.xmin, 557820);
            assert.equal(grid.ymin, 5108010);
            assert.equal(grid.xmax, 567600);
            assert.equal(grid.ymax, 5121960);
            assert.equal(grid.rowCount(), 466);
            assert.equal(grid.columnCount(), 327);
            assert.equal(grid.blankedNodesCount(), 3497);

            assert.equal(grid.minimum(), 684);
            assert.equal(grid.maximum(), 2547);

            assert.equal(grid.data[0][0], null);
            assert.equal(grid.data[272][160], 1864);

            // For manual comparing
            ////let temp = path.join(os.tmpdir(), 'surfer-grid-file-format-test-out.grd');
            ////grid.writeSync(temp, Grid.TEXT);
            ////fs.unlinkSync(temp);
        }
    });

});
