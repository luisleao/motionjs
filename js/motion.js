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


(function(context){
  var DEBUG=true;

  const DEPTH_NUMPKTS=16;
  const DEPTH_PKTSIZE=1760;
  const VIDEO_PKTSIZE=1920;

  const DEPTH_PKTDSIZE=(DEPTH_PKTSIZE-12)
  const VIDEO_PKTDSIZE=(VIDEO_PKTSIZE-12)

  const vendorId = 0x045e;
  const motor_productId = 0x02B0;   // motor
  const camera_productId = 0x02Ae;    // camera

  var EMPTY_DATA_BUFFER=new Uint8Array([0]).buffer;

  // constants
  var REQUEST_TYPES={"standard": "standard", "class": "class", "vendor": "vendor", "reserved": "reserved"};
  var RECIPIENTS={"device": "device", "interface": "interface", "endpoint": "endpoint", "other":"other"};
  var DIRECTIONS={"inbound":"in", "outbound":"out"};
  var CAMERA_ENDPOINTS={"rgb":0x81, "depth":0x82};
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
 
  function MotionJS() {
    this.depthStreamEnabled=false;
    this.motorInitialized=false;
    this.requestCounter=0;
    this.motorDeviceId=null;
    this.cameraDeviceId=null;
  }

  var logAb = function(ab) {
    var abv=new Uint8Array(ab);
    var str='';
    for (var i=0; i<abv.length && i<512; i++) {
      str+=abv[i].toString(16)+' '
    }
    if (abv.length>=512) {
      str+=((abv.length-511)+' more bytes hidden');
    }
    return str;
  }

  MotionJS.prototype.findDevice = function(onCameraEvent, onMotorEvent, onCameraFound, onMotorFound){
    var _this=this;
    chrome.experimental.usb.findDevice(vendorId, motor_productId, 
      {"onEvent": function(e) {
          if (DEBUG) console.log("[motionjs] motor event on USB: "+(e.data?("result="+e.resultCode+" data="+logAb(e.data)):e)); 
          if (onMotorEvent) onMotorEvent.call(this, e);
        }}, 
      function(dId) { 
        _this.motorDeviceId=dId; 
        if (DEBUG) console.log("[motionjs] found motor device "+JSON.stringify(dId));
        if (onMotorFound) onMotorFound.call(this, dId);
      }
    );
    chrome.experimental.usb.findDevice(vendorId, camera_productId, 
      {"onEvent": function(e) {
          if (DEBUG) console.log("[motionjs] camera event on USB: "+(e.data?("result="+e.resultCode+" data="+logAb(e.data)):e)); 
          if (onCameraEvent) onCameraEvent.call(this, e);
        }}, 
      function(dId) { 
        _this.cameraDeviceId=dId; 
        if (DEBUG) console.log("[motionjs] found camera device "+JSON.stringify(dId));
        if (onCameraFound) onCameraFound.call(this, dId);
      }
    );
  };

  MotionJS.prototype.initMotors = function(callback) {
    if (this.motorInitialized) return;
    this.motorInitialized = true;
    this.sendControl(this.motorDeviceId, DIRECTIONS.inbound, 0x10, 0, 0, null, null, 1); 
  }

  MotionJS.prototype.sendControl = function(deviceId, direction, request, value, index, data, callback, expectedResponseLength) {
    var ab;
    if (data && data.length>0) {
      ab=new Uint8Array(data).buffer;
    } else {
      ab=EMPTY_DATA_BUFFER;
    }
    return this.sendControlAB(deviceId, direction, request, value, index, ab, callback, expectedResponseLength);
  } 

  MotionJS.prototype.sendControlAB = function(deviceId, direction, request, value, index, dataAB, callback, expectedResponseLength) {
    //0x40
    var transferInfo={
      "requestType":REQUEST_TYPES.vendor,
      "recipient":RECIPIENTS.device,
      "direction":direction,
      "request":request,
      "value":value,
      "index":index,
      "data":dataAB,
      "length":expectedResponseLength
    };
    chrome.experimental.usb.controlTransfer(deviceId, transferInfo, callback);
    if (DEBUG)  console.log("[motionjs] sendControl "+JSON.stringify(transferInfo)+"  data: "+logAb(dataAB));
  }


  /*
     type  request  value                    index   data   length
     0x40     0x31     2*desired_angle_degrees  0x0     empty  0
      
     //view WARNINGS about angles. The angles is always relative to the horizon, independent of the position of Kinetic!.
    */
  MotionJS.prototype.moveHead = function(angle) {
    this.initMotors();
    this.sendControl(this.motorDeviceId, DIRECTIONS.outbound, 0x31, 2*angle, 0, []); 
  };

  /*
     type  request  value        index   data   length
     0x40     0x06     led_option   0x0     empty  0
  */
  MotionJS.prototype.setLed = function(ledName) {
    this.sendControl(this.motorDeviceId, DIRECTIONS.outbound, 0x06, LED_LIGHTS[ledName], 0, []); 
  }
  
  MotionJS.prototype.getCameraRegister = function(reg, callback) {
    this.requestCounter++;

    var i=0;
    var ab=new ArrayBuffer(12);
    var data=new DataView(ab);
    var endianess=false;
    data.setUint8(i++, 0x47);  // magic
    data.setUint8(i++, 0x4d);  // magic
    data.setUint16(i, 1, endianess); i+=2;   // length in number of words
    data.setUint16(i, 0x02, endianess); i+=2;  // command (0x03 for setRegister)
    data.setUint16(i, this.requestCounter, endianess); i+=2;  // tag (incremental counter to map to async response)
    data.setUint16(i, reg, endianess); i+=2;  // register id
    data.setUint16(i, 0x00, endianess);  

    if (DEBUG) console.log("[motionjs] asking for camera register "+reg);

    this.sendControlAB(this.cameraDeviceId, DIRECTIONS.inbound, 0, 0, 0, data.buffer, callback, 12);
  }

  MotionJS.prototype.setCameraRegister = function(reg, value, callback) {
    this.requestCounter++;

    var i=0;
    var ab=new ArrayBuffer(12);
    var data=new DataView(ab);
    var endianess=true;
    data.setUint8(i++, 0x47);  // magic
    data.setUint8(i++, 0x4d);  // magic
    data.setUint16(i, 2, endianess); i+=2;   // length in number of words
    data.setUint16(i, 0x03, endianess); i+=2;  // command (0x03 for setRegister)
    data.setUint16(i, this.requestCounter, endianess); i+=2;  // tag (incremental counter to map to async response)
    data.setUint16(i, reg, endianess); i+=2;  // register id
    data.setUint16(i, value, endianess);  // value to be set on register
    if (DEBUG) console.log("[motionjs] seting camera register "+reg+" to value "+value);

    this.sendControlAB(this.cameraDeviceId, DIRECTIONS.outbound, 0, 0, 0, data.buffer, callback, 4);
  }

  MotionJS.prototype.enableDepthStream = function() {
    this.depthStreamEnabled=true;

    /*
    set register : 0x0006 <= 0x02 ---------------------
    on send_cmd: dev=-109031408 cmd=03 cmd_len=04 reply_len=04 outbuf=47:4D:02:00:03:00:09:00:06:00:02:00  inbuf=52:42:01:00:03:00:09:00:00:00
        sendControl(DIRECTIONS.outbound, 0, 0, 0, [0x47, 0x4d, 0x02, 0, 0x03, 0, 0x09, 0, 0x05, 0x01, 0x00, 0], null, 4);
        sendControl(DIRECTIONS.outbound, 0, 0, 0, [0x47, 0x4d, 0x02, 0, 0x04, 0, 0x09, 0, 0x06, 0, 0x00, 0], null, 4);
        sendControl(DIRECTIONS.outbound, 0, 0, 0, [0x47, 0x4d, 0x02, 0, 0x05, 0, 0x09, 0, 0x12, 0x00, 0x03, 0], null, 4);
        sendControl(DIRECTIONS.outbound, 0, 0, 0, [0x47, 0x4d, 0x02, 0, 0x06, 0, 0x09, 0, 0x13, 0x00, 0x01, 0], null, 4);
        sendControl(DIRECTIONS.outbound, 0, 0, 0, [0x47, 0x4d, 0x02, 0, 0x07, 0, 0x09, 0, 0x14, 0x00, 0x1e, 0], null, 4);
        sendControl(DIRECTIONS.outbound, 0, 0, 0, [0x47, 0x4d, 0x02, 0, 0x03, 0, 0x00, 0, 0x06, 0, 0x02, 0], null, 4);
        sendControl(DIRECTIONS.outbound, 0, 0, 0, [0x47, 0x4d, 0x02, 0, 0x09, 0, 0x09, 0, 0x17, 0, 0x00, 0], null, 4);
        sendControlAB(DIRECTIONS.inbound, 0, 0, 0, new ArrayBuffer(0x200), null, 0x200);
    */

    this.setCameraRegister(0x105, 0x00); // Disable auto-cycle of projector
    this.setCameraRegister(0x06, 0x00); // reset depth stream

    this.setCameraRegister(0x12, 0x03); // 11-bit stream (Depth Stream Format)
    this.setCameraRegister(0x13, 0x01); // standard - 640x480 (Depth Stream Resolution)
    this.setCameraRegister(0x14, 0x1e); // 30 fps (Depth Framerate)
    this.setCameraRegister(0x06, 0x02); // start depth stream
    this.setCameraRegister(0x17, 0x00); // disable depth hflip

    //clear buffer data to work
    this.sendControlAB(this.cameraDeviceId, DIRECTIONS.inbound, 0, 0, 0, new ArrayBuffer(0x200), null, 0x200);



    // ARGH, this is awful! find a solution for the async nature of this
    //this.sendControl(this.cameraDeviceId, DIRECTIONS.outbound, 0, 0, 0, [0x47, 0x4d, 0x02, 0, 0x03, 0, 0x00, 0, 0x06, 0, 0x02, 0], null, 4);
  }

  MotionJS.prototype.requestDepthFrame = function() {  


    // funcionamento para carregar:
    // gera a isochronus primeiro antes de ativar o IR
    // ou seja, chamar enableDepthStream após inicializar isochronus

    //res = fnusb_start_iso(&dev->usb_cam, &dev->depth_isoc, depth_process, 0x82, NUM_XFERS, PKTS_PER_XFER, DEPTH_PKTBUF);
    //      fnusb_start_iso(fnusb_dev *dev, fnusb_isoc_stream *strm, fnusb_iso_cb cb, int ep, int xfers, int pkts, int len)


    // funcionamento na freekinect
    // freenect_start_depth
    //   dev->depth.pkt_size = DEPTH_PKTDSIZE;
    //   dev->depth.flag = 0x70;
    //   dev->depth.variable_length = 0;
    
    //   stream_init(ctx, &dev->depth, freenect_find_depth_mode(dev->depth_resolution, FREENECT_DEPTH_11BIT_PACKED).bytes, freenect_find_depth_mode(dev->depth_resolution, FREENECT_DEPTH_11BIT).bytes);
         // ou
    //   stream_init(ctx, &dev->depth, 0, freenect_find_depth_mode(dev->depth_resolution, dev->depth_format).bytes);
    
    //   res = fnusb_start_iso(&dev->usb_cam, &dev->depth_isoc, depth_process, 0x82, NUM_XFERS, PKTS_PER_XFER, DEPTH_PKTBUF);
    //     (a fnusb_start_iso aloca os pacotes)
    //     libusb_alloc_transfer(pkts);

    console.log(DEPTH_NUMPKTS, DEPTH_PKTSIZE);

    var isoInfo = {
      "transferInfo": {
        "direction": DIRECTIONS.inbound,
        "endpoint": CAMERA_ENDPOINTS.depth,
        "length": DEPTH_NUMPKTS*DEPTH_PKTSIZE,
        "data": new ArrayBuffer(30720)
      },
      "packets": DEPTH_NUMPKTS,
      "packetLength": DEPTH_PKTSIZE
    };
    if (DEBUG) console.log("[motionjs] sendIsochronous "+JSON.stringify(isoInfo));
    

    chrome.experimental.usb.isochronousTransfer(this.cameraDeviceId, isoInfo, function(){
      console.info("iso_callback");
      console.info(arguments.length);
      console.debug(arguments);
      console.info("end iso");
    });


  }

  MotionJS.prototype.disableDepthStream = function() {
    this.setCameraRegister(0x06, 0x00);
    
    //clear buffer data to work
    this.sendControlAB(this.cameraDeviceId, DIRECTIONS.inbound, 0, 0, 0, new ArrayBuffer(0x200), null, 0x200);
    this.depthStreamEnabled=false;
  }

  MotionJS.prototype.getDeviceId=function() { 
    return deviceId;
  }

  MotionJS.prototype.isDepthStreamEnabled=function() { 
    return this.depthStreamEnabled;
  }

  context.MotionJS=MotionJS;

})(window);


/*
On libfreenct:
  #define PKTS_PER_XFER 16
  #define NUM_XFERS 16
  #define DEPTH_PKTBUF 1920
res = fnusb_start_iso(&dev->usb_cam, &dev->depth_isoc, depth_process, 0x82, NUM_XFERS, PKTS_PER_XFER, DEPTH_PKTBUF)
res = fnusb_start_iso(device=&dev->usb_cam, isocstream=&dev->depth_isoc, callback, endpoint=0x82, xfers=16, pkts=16, len=1920)
        strm->parent = dev;
        strm->cb = cb;
        strm->num_xfers = xfers;
        strm->pkts = pkts;
        strm->len = len;
        strm->buffer = (uint8_t*)malloc(xfers * pkts * len);
        strm->xfers = (struct libusb_transfer**)malloc(sizeof(struct libusb_transfer*) * xfers);
        strm->dead = 0;
        strm->dead_xfers = 0;

        uint8_t *bufp = strm->buffer;

                strm->xfers[i] = libusb_alloc_transfer(pkts);

                libusb_fill_iso_transfer(strm->xfers[i], dev->dev, 
                      ep, bufp, pkts * len, pkts, iso_callback, strm, 0);

                libusb_set_iso_packet_lengths(strm->xfers[i], len);

                ret = libusb_submit_transfer(strm->xfers[i]);


Variable equivalence:
NUM_XFERS_chrome=1 (one per time, makes no sense on chrome.usb)

packets_chrome=pkts_freenct=16
packet_length_chrome=len_freenct=1920
length_chrome=HASTOBE packets*packet_length = 30720
timeout = 0


sizeof(transfer_chrome)=packets
sizeof(buffer->data())=packets*packet_length

isotransfer={
  generic_transfer: {
    direction: IN,
    length: packets*packet_length=16*1920,
    endpoint: 0x82,
    
  },
  packets:16,
  packet_length: 1920,
}

UsbDevice::IsochronousTransfer parameters:
direction=IN
endpoint=0x82
buffer=sizeof(buffer->data())=30720
length=30720
packets=16
packet_length=1920
timeout=0
callback=whatever



On chrome.usb:
void UsbDevice::IsochronousTransfer(direction, endpoint, buffer, length, packets, packet_length, timeout, callback) {
  struct libusb_transfer* const transfer = libusb_alloc_transfer(packets);

CHECK THIS: (why endpoint = direction | endpoint? makes sense?)
        LIBUSB_ENDPOINT_IN = 0x80,
        LIBUSB_ENDPOINT_OUT = 0x00
  const uint8 new_endpoint = ConvertTransferDirection(direction) | endpoint;   

  libusb_fill_iso_transfer(transfer, handle_, 
      new_endpoint, buffer->data(), length, packets, callback, this, timeout);

  libusb_set_iso_packet_lengths(transfer, packet_length);

  SubmitTransfer(transfer, buffer, callback);
}






*/

