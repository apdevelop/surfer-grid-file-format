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
    });
});

describe('read write files', function () {

    it('read file', function () {
        let grid = new Grid().readSync(path.join(__dirname, 'sample-1-surfer6.grd'));

        assert.equal(grid.rowCount(), 3);
        assert.equal(grid.columnCount(), 4);
        assert.equal(grid.blankedNodesCount(), 1);
    });

    it('read write file', function () {
        let grid = new Grid();
        grid.readSync(path.join(__dirname, 'sample-1-surfer10.grd'));

        assert.equal(grid.rowCount(), 3);
        assert.equal(grid.columnCount(), 4);
        assert.equal(grid.blankedNodesCount(), 1);

        grid.data[0][0] = null;
        grid.data[1][2] = 5;

        let temp = path.join(os.tmpdir(), 'surfer-grid-file-format-test-out.grd');
        grid.writeSync(temp);

        let grid2 = new Grid().readSync(temp);
        assert.equal(grid2.blankedNodesCount(), 2);
        assert.equal(grid.data[0][0], null);
        assert.equal(grid.data[1][2], 5);

        fs.unlinkSync(temp);
    });

});
