node-apple-remote
=================

Simple node.js library for receiving events from an aluminum Apple Remote

### Usage

[![NPM](https://nodei.co/npm/node-apple-remote.png?mini=true)][1]

```javascript
var AppleRemote = require('node-apple-remote');
var remote = new AppleRemote();
try {
    remote.open()
          .on('left', /* ... */)
          .on('left.long', /* ... */)
          .on('left.long.released', /* ... */)
          .on('center', /* ... */)
          .on('center.long', /* ... */)
} catch (e) {
    // an exception is thrown if the apple remote
    //  device was not found on the system
}
```

### All events

```javascript
'raw'                  // Every single event; the Button pressed is passed.
                       // it is unlikely you will need this
'button'               // Each parsed button event; for example, 'left'
                       //  will never have a 'left.released' follow it,
                       //  though a 'raw' Released event may fire. In
                       //  most cases, it may be easiest to register
                       //  specific listeners (below)

'left'                 // single-press
'left.long'            // long-press (as in rewind); release to follow
'left.long.released'   // release of long-press 
'right' 
'right.long' 
'right.long.released' 

'up'                   // pressed; release ALWAYS follows
'up.released'          // note that there is no up.long
'down'
'down.released'

'center'               // single-press only
'center.long'          // long-press only (not "holdable")
'playpause'
'playpause.long'
'menu'
'menu.long'

'error'                // emits with the an error Object from node-hid
```

### node-apple-remote and Electron/NW.js

If using this library with [Electron][2] or [NW.js][3], see the 
[notes from node-hid][4].

[1]: https://nodei.co/npm/node-apple-remote/
[2]: http://electron.atom.io/
[3]: http://nwjs.io
[4]: https://github.com/node-hid/node-hid#using-node-hid-in-electron-projects
