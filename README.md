# Surfer grid file format

### Surfer grid (.grd) file format implementation for Node.js.

Surfer grid (.grd) file format reading and writing very basic implementation for Node.js.

### Usage

Offline installation from local folder

Run in this repo folder to create tarball package
`npm pack`

Run in application folder
`npm install <path/to/surfer-grid-file-format-0.0.1.tgz>`


```javascript
var Grid = require('surfer-grid-file-format');

// Creating from two-dimensional array
var grid = new Grid([
    [0, 1, 1, null],
    [2, 3, 5, 1],
    [1, 3, 2, 1]],
    0, 0, 30, 20);

console.log(grid.data[1][2]); // => 5
console.log(grid.rowCount()); // => 3
console.log(grid.columnCount()); // => 4
console.log(grid.blankedNodesCount()); // => 1

// Reading from file
var grid1 = new Grid().readSync('./input.grd'); // Chained method call

// Write to file
grid.writeSync('./out.grd');
```

### API
Grid data represented in memory as two-dimensional array of 64-bit `Number` values. Blanked nodes
has `null` value, but stored in file as special `NoData` value, `1.70141e+038`.

### TODOs
* API improvements.
* Input data validation.
* Binary format support.
* Async I/O.

### References
* [Surfer 6 Text Grid Format](http://surferhelp.goldensoftware.com/topics/ascii_grid_file_format.htm)
* [Surfer 6 Binary Grid File Format](http://surferhelp.goldensoftware.com/topics/surfer_6_grid_file_format.htm)
