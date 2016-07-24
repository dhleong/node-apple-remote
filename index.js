
var util = require('util')
  , events = require('events')
  , HID = require('node-hid')
  , VENDOR_ID = 0x5ac
  , PRODUCT_ID = 0x8242;

/*
 * Data definitions
 */

function Button(data1, data2, data3, holdable) {
    this.data1 = data1;
    this.data2 = data2;
    this.data3 = data3;
    this.holdable = holdable;
}

var Buttons = {
    Released:  new Button(0,    0,    0)
  , Center:    new Button(0x01, 0,    0)
  , PlayPause: new Button(0x06, 0,    0)
  , Menu:      new Button(0,    0x01, 0)
  , Right:     new Button(0,    0x03, 0)
  , Left:      new Button(0,    0x04, 0)
  , Up:        new Button(0,    0x10, 0, true)
  , Down:      new Button(0,    0x20, 0, true)
};

Buttons.Center.Long    = new Button(0x09, 0, 0);
Buttons.Left.Long      = new Button(0x10, 0, 0, true);
Buttons.Right.Long     = new Button(0x20, 0, 0, true);
Buttons.Menu.Long      = new Button(0x80, 0, 0);
Buttons.PlayPause.Long = new Button(0,    0, 0x04);

var ButtonsIndex = {};

function _register(key, button) {
    button.name = key;
    if (!ButtonsIndex[button.data1])
        ButtonsIndex[button.data1] = {};
    if (!ButtonsIndex[button.data1][button.data2])
        ButtonsIndex[button.data1][button.data2] = {};
    if (!ButtonsIndex[button.data1][button.data2][button.data3])
        ButtonsIndex[button.data1][button.data2][button.data3] = {};

    ButtonsIndex[button.data1][button.data2][button.data3] = button;

    if (button.Long) {
        _register(key + '.Long', button.Long);
    }
}

Object.keys(Buttons).forEach(function(key) {
    var button = Buttons[key];
    _register(key, button);
});

Button.from = function(data) {
    return ButtonsIndex[data[1]][data[2]][data[3]];
}

/*
 * util
 */

function find() {
    var found = false;
    HID.devices().some(function(device) {
        if (device.vendorId == VENDOR_ID
                && device.productId == PRODUCT_ID) {
            found = device;
            return true;
        }
    });
    return found;
}

function open() {
    var info = find();
    if (!info) throw new Error("Could not find Apple IR device");

    return new HID.HID(info.path);
}

/**
 * Remote is an EventEmitter. To begin receiving events, you must call open().
 *
 * @param opts Object An options object:
 *   - suppressErrors: (default: true) If `true`, any errors emitted by the
 *                      device will trigger a close and re-open, transparently.
 *                      Otherwise, errors will be emitted as `error`.
 */
function Remote(opts) {
    this.opts = Object.assign({
        suppressErrors: true
    }, opts);
}
util.inherits(Remote, events.EventEmitter);

/**
 * Attempt to open the AppleRemote device.
 * @throws Error if no Apple IR device was
 *  found on the system
 * @throws Error if already open
 * @return this Same instance for chaining
 */
Remote.prototype.open = function() {
    if (this.device) throw new Error("Already open");

    // open; throws Error if no device found
    this.device = open();

    var self = this;
    this.device.on('data', function(data) {
        try {
            var button = Button.from(data);
        } catch (e) {
            var thrown = new Error("Unable to parse remote data");
            thrown.data = data;
            self.emit('warning', thrown);
            return;
        }

        self.emit('raw', button);

        if (button != Buttons.Released
                || !self.previous
                || self.previous.holdable) {
            self.emit('button', button);
            self.emit(button.name.toLowerCase());
        } 

        if (button == Buttons.Released
                && self.previous
                && self.previous.holdable) {

            self.emit(self.previous.name.toLowerCase() + '.released');
        }

        self.previous = button;
    });

    this.device.on('error', function(e) {
        if (self.opts.suppressErrors) {
            // NB: this is experimental, because it takes *hours*
            //  (days?) for the repro to occur. My suspicion is that
            //  one of two things happen when the read error is thrown:
            //   1. The device is closed, and trying to close() it will
            //      throw an error
            //   2. The device can be closed safely.
            // This try-catch should handle both cases, and dump a
            //  message into the console if case 1 occured
            try {
                self.close();
            } catch (e) {
                console.warn(e);
                self.device = null;
            }
            self.open();
        } else {
            // just forward along
            self.emit('error', e);
        }
    });

    return this;
};

/**
 * Pause events. No listeners will be fired
 *  until resume() is called (but listeners
 *  will stay attached, unlike close()).
 *
 * Unfortunately, it does NOT seem to relinquish
 *  control of the device, so nobody else will
 *  get events, either. If you want OSX to handle
 *  the remote's events, you're better off
 *  just calling close()
 *
 * @throws Error if not open. 
 */
Remote.prototype.pause = function() {
    if (!this.device) throw new Error("Not open()'d yet");
    this.device.pause();
};

/**
 * Resume events
 *
 * @throws Error if not open. 
 * @see #pause()
 */
Remote.prototype.resume = function() {
    if (!this.device) throw new Error("Not open()'d yet");
    this.device.resume();
};



/**
 * Closes the device; any registered listeners
 *  will remain registered
 */
Remote.prototype.close = function() {
    // unregister listeners to prevent segfault
    if (this.device) {
        this.device.removeAllListeners();
        this.device.close();
    }
    this.device = null;
};


module.exports = Remote;
module.exports.Buttons = Buttons;
