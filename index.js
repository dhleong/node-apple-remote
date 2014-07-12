
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

    if (button.Long)
        _register(key + '.Long', button.Long);
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
    if (!info)
        throw new Error("Could not find Apple IR device");

    return new HID.HID(info.path);
}

/**
 * Public-facing class; accessed via open().
 * Remote is an EventEmitter. It is not
 * recommended to call removeAllListeners()
 * on this object
 */
function Remote(device) {
    this.device = device;
    this._resetListeners();
}
util.inherits(Remote, events.EventEmitter);

Remote.prototype._resetListeners = function() {
    this.removeAllListeners();
    this._registered = false;
    this.on('newListener', this._register);
};


Remote.prototype._register = function() {

    if (this._registered)
        return;
    this._registered = true;

    if (!this.device) {
        // we must've closed... re-open!
        this.device = open();
    }

    var self = this;
    this.device.on('data', function(data) {
        var button = Button.from(data);
        self.emit('raw', button);

        if (button != Buttons.Released
                || !self.previous
                || self.previous.holdable) {
            self.emit('button', button);
            self.emit(button.name.toLowerCase());
        } 

        if (button == Buttons.Released
                && self.previous.holdable) {

            self.emit(self.previous.name.toLowerCase() + '.released');
        }

        self.previous = button;
    });
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
 */
Remote.prototype.pause = function() {
    this.device.pause();
};

/**
 * Resume events
 */
Remote.prototype.resume = function() {
    this.device.resume();
};



/**
 * Closes the device; all listeners are detached
 *  and no events will be fired until new ones
 *  are re-attached
 */
Remote.prototype.close = function() {
    // unregister listeners to prevent segfault
    if (this.device) {
        this.device.removeAllListeners();
        this.device.close();
    }
    this.device = null;

    this._resetListeners();
};


module.exports = new Remote(open());
module.exports.Buttons = Buttons;
