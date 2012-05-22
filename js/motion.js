/*


Control Transfer (8-bytes) Request:
RequestType (1 byte)
Request     (1 byte)
Value       (2 bytes)
Index       (2 bytes)
Length      (2 bytes)

The common values used for the RequestType field when talking to a Kinect are:
0x80  (LIBUSB_REQUEST_TYPE_STANDARD | LIBUSB_RECIPIENT_DEVICE | LIBUSB_ENDPOINT_IN)
0x40  (LIBUSB_REQUEST_TYPE_VENDOR   | LIBUSB_RECIPIENT_DEVICE | LIBUSB_ENDPOINT_OUT)
0xc0  (LIBUSB_REQUEST_TYPE_VENDOR   | LIBUSB_RECIPIENT_DEVICE | LIBUSB_ENDPOINT_IN)

For read packets (RequestType 0x80 and 0xc0) Length is the length of the response.

*/


var motionjs__init = function(){
  var DEBUG=true;

  // constants
  var REQUEST_TYPES={"standard": "standard", "class": "class", "vendor": "vendor", "reserved": "reserved"};
  var RECIPIENTS={"device": "device", "interface": "interface", "endpoint": "endpoint", "other":"other"};
  var DIRECTIONS={"inbound":"in", "outbound":"out"};
  var LED_LIGHTS= {
    "LED_OFF": 0,
    "LED_GREEN": 1,
    "LED_RED": 2,
    "LED_YELLOW": 3, //(actually orange)
    "LED_BLINK_YELLOW": 4, //(actually orange)
    "LED_BLINK_GREEN": 5,
    "LED_BLINK_RED_YELLOW": 6 //(actually red/orange)
  };
  // end of constants
 
  var deviceId;
  var transferInfo = {
    "requestType": "",
    "recipient": "",
    "direction": "",
    "request": 0,
    "value": 0,
    "index": 0,
    "data": [0],
    "length": 0
  };

  var depthStreamEnabled=false;
  var motorInitialized=false;
  
  var findDevice = function(vendorId, productId, onUsbEventCallback, onDeviceFoundCallback){
    chrome.experimental.usb.findDevice(vendorId, productId, 
      {"onEvent": function(e) {
          if (DEBUG) { console.log("[motionjs] event on USB"); console.log(e); };
          if (onUsbEventCallback) onUsbEventCallback.call(this, e);
        }
      }, 
      function(dId) { 
        deviceId=dId; 
        if (DEBUG) { console.log("[motionjs] found device"); console.log(dId); };
        if (onDeviceFoundCallback) onDeviceFoundCallback.call(this, dId);
      }
    );
  };

  var initMotors = function(callback) {
    if (motorInitialized) return;
    motorInitialized = true;
    receiveControlTransfer(0x10, 0, 0, null, 0);
  }

  var sendControlTransfer = function(request, value, index, data) {
    //0x40
    transferInfo.requestType=REQUEST_TYPES.vendor;
    transferInfo.recipient=RECIPIENTS.device;
    transferInfo.direction=DIRECTIONS.outbound;
    transferInfo.request=request;
    transferInfo.value=value;
    transferInfo.index=index;
    if (data && data.length>0) transferInfo.data=data;
    var ret = chrome.experimental.usb.controlTransfer(deviceId, transferInfo);
    if (DEBUG) { console.log("[motionjs] sendControlTransfer"); console.log(ret); };
  }

  var receiveControlTransfer = function(request, value, index, data, length) {
    // 0xc0
    transferInfo.requestType=REQUEST_TYPES.vendor;
    transferInfo.recipient=RECIPIENTS.device;
    transferInfo.direction=DIRECTIONS.inbound;
    transferInfo.request=request;
    transferInfo.value=value;
    transferInfo.index=index;
    if (data && data.length>0) transferInfo.data=data;
    transferInfo.length=length;
    var ret = chrome.experimental.usb.controlTransfer(deviceId, transferInfo);
    if (DEBUG) { console.log("[motionjs] receiveControlTransfer"); console.log(ret); };
  }


  /*
     type  request  value                    index   data   length
     0x40     0x31     2*desired_angle_degrees  0x0     empty  0
      
     //view WARNINGS about angles. The angles is always relative to the horizon, independent of the position of Kinetic!.
    */
  var moveHead = function(angle) {
    initMotors();
    sendControlTransfer(0x31, 2*angle, 0, []); 
  };

  var getAccel = function(angle) {
    receiveControlTransfer(0x32, 0, 0, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 10);
    //sendControlTransfer(0x31, 2*angle, 0, []); 
  };

  /*
     type  request  value        index   data   length
     0x40     0x06     led_option   0x0     empty  0
  */
  var setLed = function(led) {
    sendControlTransfer(0x06, led, 0, []); 
  }
  

  var enableDepthStream = function(callback) {
    depthStreamEnabled=true;
  }

  var disableDepthStream = function() {
    depthStreamEnabled=false;
  }

  return { 
    "LED_LIGHTS": LED_LIGHTS,
    "REQUEST_TYPES": REQUEST_TYPES,
    "RECIPIENTS": RECIPIENTS,
    "DIRECTIONS": DIRECTIONS,
    "findDevice": findDevice,
    "moveHead": moveHead,
    "getAccel": getAccel,
    "setLed": setLed,
    "enableDepthStream": enableDepthStream,
    "disableDepthStream": disableDepthStream,
    "isDepthStreamEnabled": function() { return depthStreamEnabled; },
  }

};

var motionjs=motionjs__init();


