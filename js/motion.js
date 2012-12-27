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
  var DEBUG_DATA=false;

  // for Mac:
  
  const DEPTH_NUMPKTS=128;
  
  // for Linux:
  /*
  const DEPTH_NUMPKTS=16;
  */

  const DEPTH_PKTBUF=1920;
  const DEPTH_PKTSIZE=1760;
  
  const DEPTH_PKTDSIZE=(DEPTH_PKTSIZE-12)

  const vendorId = 0x045e;   // decimal: 1118
  const motor_productId = 0x02B0;   // motor, decimal: 688
  const camera_productId = 0x02Ae;    // camera, decimal: 686
  const endianess=true;


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
    this.motorDevice=null;
    this.cameraDevice=null;
    this.debugData = [];
    this.framePosition=-1;
    this.canvasContext=null;
    this.imageData=null;
    this.bitsPerPixel=1;
    this.lastTimestamp=0;
    this.lastSeq=0;
    this.currentSeq=0;
  }

  var logAb = function(ab) {
    return logAbFull(ab, false);
  }

  var logAbFull = function(ab, all) {
    var SHOW_ONLY=40;
    var abv=new Uint8Array(ab);
    var str='';
    for (var i=0; i<abv.length && (all || i<SHOW_ONLY); i++) {
      str+=abv[i].toString(16)+' '
    }
    if (!all && abv.length>=SHOW_ONLY) {
      str+=((abv.length-SHOW_ONLY)+' more bytes hidden');
    }
    return str;
  }

  MotionJS.prototype.setCanvas= function(canvasContext, bitsPerPixel) {
    this.canvasContext=canvasContext;
    this.bitsPerPixel=bitsPerPixel;
    this.imageData=canvasContext.getImageData(0, 0, 640/bitsPerPixel, 480/bitsPerPixel);
    
    
    // debug:
    document.addEventListener('DOMContentLoaded', function() {
      var b=document.createElement('button');
      var bp=document.createElement('button');
      b.innerText="-decrease";
      bp.innerText="+increase";
      b.addEventListener('click', function() {
        expected_pkt_size--;
      });
      bp.addEventListener('click', function() {
        expected_pkt_size++;
      });
      document.body.appendChild(b);
      document.body.appendChild(bp);
    });
  }

  var findDeviceWithPermission = function(onCameraFound, onMotorFound) {
    var _this=this;
    chrome.usb.findDevices({"vendorId": vendorId, "productId": motor_productId},
/*
      {"onEvent": function(e) {
          if (DEBUG) console.log("[motionjs] motor event on USB: "+(e.data?("result="+e.resultCode+" data="+logAb(e.data)):e)); 
          if (DEBUG_DATA) _this.debugData.push({"timestamp": Date.now(), "device": "motor", "direction": "tocomputer", "event": e, "event.data": logAbFull(e.data, true)});
          if (onMotorEvent) onMotorEvent.call(this, e);
        }}, 
*/
      function(device) { 
        if (!device || !device.length) {
          console.error("Could not find device");
          return;
        }
        _this.motorDevice=device[0]; 
        if (DEBUG) console.log("[motionjs] found motor device "+JSON.stringify(device[0]));
        if (onMotorFound) onMotorFound.call(this, device[0]);
      }
    );

    chrome.usb.findDevices({"vendorId": vendorId, "productId": camera_productId},
/*
      {"onEvent": function(e) {
          //if (DEBUG_DATA) _this.debugData.push({"timestamp": Date.now(), "device": "camera", "direction": "tocomputer", "event": e});
          //if (onCameraEvent) onCameraEvent.call(this, e);
          var offset=0;
          for (var i=0; i<DEPTH_NUMPKTS && offset<e.data.byteLength-DEPTH_PKTBUF; i++, offset+=DEPTH_PKTBUF) {
            _this.processDepthFrame(new Uint8Array(e.data, offset, DEPTH_PKTBUF));
          }
          if (_this.canvasContext && _this.imageData) {
            _this.canvasContext.putImageData(_this.imageData, 0, 0);
          }

          if (DEBUG) console.log("[motionjs] camera event on USB: "+(e.data?("result="+e.resultCode+" data="+logAbFull(e.data)):e)); 
          if (_this.depthStreamEnabled) {
            webkitRequestAnimationFrame(function() { _this.requestDepthFrame() });
          }

        }}, */
      function(device) { 
        if (!device || !device.length) {
          console.error("Could not find device");
          return;
        }
        _this.cameraDevice=device[0]; 
        if (DEBUG) console.log("[motionjs] found camera device "+JSON.stringify(device[0]));
        if (onCameraFound) onCameraFound.call(this, device[0]);
      }
    );
  }

  MotionJS.prototype.findDevice = function(onCameraEvent, onMotorEvent, onCameraFound, onMotorFound){
    var _this = this;
    chrome.permissions.request( 
      {permissions: [
          {'usbDevices': [
            {'vendorId': vendorId, "productId": camera_productId},
            {'vendorId': vendorId, "productId": motor_productId}
          ] }
       ]}, 
    function(result) {
      if (result) { 
        console.log('App was granted the "usbDevices" permission: '+result);
        findDeviceWithPermission.call(_this, onCameraFound, onMotorFound);
      } else {
        console.error('App was NOT granted the "usbDevices" permission.');
      }  
    });
  };

  MotionJS.prototype.initMotors = function(callback) {
    if (this.motorInitialized) return;
    this.motorInitialized = true;
    this.sendControl(this.motorDevice, DIRECTIONS.inbound, 0x10, 0, 0, null, null, 1);
  }

  MotionJS.prototype.sendControl = function(device, direction, request, value, index, data, callback, expectedResponseLength) {
    var ab;
    if (data && data.length>0) {
      ab=new Uint8Array(data).buffer;
    } else {
      ab=EMPTY_DATA_BUFFER;
    }
    return this.sendControlAB(device, direction, request, value, index, ab, callback, expectedResponseLength);
  } 

  MotionJS.prototype.sendControlAB = function(device, direction, request, value, index, dataAB, callback, expectedResponseLength) {
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
    if (DEBUG_DATA) this.debugData.push({"timestamp": Date.now(), "device": "motor", "direction": "todevice", "transferInfo": transferInfo, "info.data": logAbFull(dataAB, true)});
    chrome.usb.controlTransfer(device, transferInfo, 
      function(result) {
        if (DEBUG) console.log("result: ", result);
        if (callback) callback(result);
      }); 
    if (DEBUG)  console.log("[motionjs] sendControl "+JSON.stringify(transferInfo)+"  data: "+logAb(dataAB));
  }


  /*
     type  request  value                    index   data   length
     0x40     0x31     2*desired_angle_degrees  0x0     empty  0
      
     //view WARNINGS about angles. The angles is always relative to the horizon, independent of the position of Kinetic!.
    */
  MotionJS.prototype.moveHead = function(angle) {
    this.initMotors();
    this.sendControl(this.motorDevice, DIRECTIONS.outbound, 0x31, 2*angle, 0, []);
  };

  /*
     type  request  value        index   data   length
     0x40     0x06     led_option   0x0     empty  0
  */
  MotionJS.prototype.setLed = function(ledName) {
    this.sendControl(this.motorDevice, DIRECTIONS.outbound, 0x06, LED_LIGHTS[ledName], 0, []); 
  }
  
  MotionJS.prototype.getCameraRegister = function(reg, callback) {
    this.requestCounter++;

    var i=0;
    var ab=new ArrayBuffer(12);
    var data=new DataView(ab);
    data.setUint8(i++, 0x47);  // magic
    data.setUint8(i++, 0x4d);  // magic
    data.setUint16(i, 1, endianess); i+=2;   // length in number of words
    data.setUint16(i, 0x02, endianess); i+=2;  // command (0x03 for setRegister)
    data.setUint16(i, this.requestCounter, endianess); i+=2;  // tag (incremental counter to map to async response)
    data.setUint16(i, reg, endianess); i+=2;  // register id
    data.setUint16(i, 0x00, endianess);  

    if (DEBUG) console.log("[motionjs] asking for camera register "+reg);

    this.sendControlAB(this.cameraDevice, DIRECTIONS.inbound, 0, 0, 0, data.buffer, callback, 12);
  }

  MotionJS.prototype.setCameraRegister = function(reg, value, callback) {
    this.requestCounter++;

    var i=0;
    var ab=new ArrayBuffer(12);
    var data=new DataView(ab);
    data.setUint8(i++, 0x47);  // magic
    data.setUint8(i++, 0x4d);  // magic
    data.setUint16(i, 2, endianess); i+=2;   // length in number of words
    data.setUint16(i, 0x03, endianess); i+=2;  // command (0x03 for setRegister)
    data.setUint16(i, this.requestCounter, endianess); i+=2;  // tag (incremental counter to map to async response)
    data.setUint16(i, reg, endianess); i+=2;  // register id
    data.setUint16(i, value, endianess);  // value to be set on register
    if (DEBUG) console.log("[motionjs] seting camera register "+reg+" to value "+value);

    this.sendControlAB(this.cameraDevice, DIRECTIONS.outbound, 0, 0, 0, data.buffer, callback, 4);
  }

  MotionJS.prototype.enableDepthStream = function() {
    this.depthStreamEnabled=true;

    this.setCameraRegister(0x105, 0x00); // Disable auto-cycle of projector
    this.setCameraRegister(0x06, 0x00); // reset depth stream

//    var _this=this;
//    webkitRequestAnimationFrame(function() { _this.requestDepthFrame() });

    this.setCameraRegister(0x12, 0x03); // 11-bit stream (Depth Stream Format)
    this.setCameraRegister(0x13, 0x01); // standard - 640x480 (Depth Stream Resolution)
    this.setCameraRegister(0x14, 0x1e); // 30 fps (Depth Framerate)
    this.setCameraRegister(0x06, 0x02); // start depth stream
    this.setCameraRegister(0x17, 0x00); // disable depth hflip

    //clear buffer data  // apparent hack grabbed from freenect
    this.sendControlAB(this.cameraDevice, DIRECTIONS.inbound, 0, 0, 0, new ArrayBuffer(0x200), null, 0x200);
  }
 
 var expected_pkts_per_frame=242;
 var expected_frame_size=640*480*11/8;
 var expected_pkt_size=1760-12;
var first_pkt_seq=-1;

MotionJS.prototype.processDepthFrame = function(response) {
    if (response[0]===0x52 && response[1]===0x42) {  // "RB" is the magic bytes for camera response
      var seqNum, pkt_seq, lengthHigh, lengthLow, timestamp;
      var flag=response[3],
          pkt_seq=response[5],
          timestamp=response[11]*256*256*256+response[10]*256*256+response[9]*256+response[8];
     
      if (DEBUG) console.log("flag="+flag.toString(16)+" pkt_seq="+pkt_seq+" timestamp="+timestamp+" datalen="+(response.byteLength-11));
      var validFrame=false;
      switch (flag) {
        case (0x71): // new frame
          validFrame=true;
          this.framePosition=0;
          this.currentSeq=0;
          first_pkt_seq=pkt_seq;
          console.log(" ------- *** new frame");
          this.processFrame(response);
          break;
        case (0x72):  // middle of frame
          var pktDiff=pkt_seq-this.lastSeq;
          if (pktDiff<0) pktDiff+=256;
          if (this.framePosition<0 || pktDiff>30 || this.lastTimestamp-Date.now()>5000) {
            // got out of sync, will do nothing until the next new_frame
            console.log("out of sync, waiting for new_frame");
            this.lastTimestamp=-1;
          } else {
            validFrame=true;
            this.currentSeq+=pktDiff;
            this.framePosition=this.currentSeq*expected_pkt_size;
            if (response.length!=DEPTH_PKTBUF) {
              console.log("*** WARNING: response.length="+response.length+"   expected_pkt_size="+expected_pkt_size);
            }
            if (true || this.currentSeq<100) {
              console.log("diff="+pktDiff+"  first_pkt_seq="+first_pkt_seq+" pkt_seq="+pkt_seq+"  lastseq="+this.lastSeq+"  currentFrame="+this.currentSeq+" framePosition="+this.framePosition);
              this.processFrame(response);
            }
          }
          break;
        case (0x75):  // end of frame
          if (this.framePosition>0) {
            //this.processFrame(response);
            validFrame=true;
          }
          this.framePosition=-1;
        break;
      } 
      if (validFrame) {
        this.lastSeq=pkt_seq;
        this.lastTimestamp=Date.now();
      }
    } else {
        if (DEBUG) console.log("ignoring packet, no magic number");
    }
  };

  MotionJS.prototype.logIsoPacket = function(ab, offset, len) {
    var SHOW_ONLY=32;
    var abv=new Uint8Array(ab, offset || 0, len || ab.byteLength);
    var str=this.framePosition+" "+abv.byteOffset+"->"+(abv.byteOffset+abv.length)+": ";
    for (var i=3; i<abv.length && i<SHOW_ONLY; i++) {
      if (i==5) {
        str+=(abv[i]<100?' ':'')+(abv[i]<10?' ':'')+abv[i]+" ";
      } else if (i==8) {
        timestamp=""+(abv[10]*256*256+abv[9]*256+abv[8]);
        for (var j=0; j<9-timestamp.length; j++) {
          str+=" ";
        }
        str+=timestamp+" - ";
        i+=3;
      } else if (i==4 || i==6 || i==7) {
      } else {
        str+=(abv[i]<16?' ':'')+abv[i].toString(16)+' '
      }
    }
    str+=" ... ";
    for (var i=abv.length-10; i<abv.length; i++) {
        str+=(abv[i]<16?' ':'')+abv[i].toString(16)+' '
    }
    str+=" ("+(abv.length-12)+" b)";
    return str;
  }

  MotionJS.prototype.logIsoPacketSimple = function(ab, offset, len) {
    var SHOW_ONLY=36;
    var abv=new Uint8Array(ab, offset || 0, len || ab.byteLength);
    var str=this.framePosition+" "+abv.byteOffset+"->"+(abv.byteOffset+abv.length)+": ";
    for (var i=0; i<abv.length && i<SHOW_ONLY; i++) {
      str+=(abv[i]<16?' ':'')+abv[i].toString(16)+' '
    }
    str+=" ... ";
    for (var i=abv.length-10; i<abv.length; i++) {
        str+=(abv[i]<16?' ':'')+abv[i].toString(16)+' '
    }
    return str;
  }

 var t_gamma=[]
 for (var i=0; i<2048; i++) {
   var v=i/2048.0;
   v = v*v*v*6;
   t_gamma.push(v*6*256);
 }
 
 var convertPacked11To16bits=function(raw, dest, framePosition) {
   var vw=11;
   var offset=Math.floor(framePosition*8/vw);
   var n=Math.floor(Math.min(raw.length, DEPTH_PKTDSIZE)*8/vw);
   var buffer=0;
   var bitsIn=0;
   var srcOffset=0;
   var mask=0x7ff;
   //console.log("  framePosition="+framePosition+" initial pixel="+offset+" initial n="+n+"  raw.length="+raw.length);
   //var debug_=[];
   
   while (n>0) {
     while (bitsIn<vw) {
       buffer = (buffer<<8) | raw[srcOffset++];
       bitsIn+=8;
     }
     bitsIn -= vw;
//     var b=Math.floor(((buffer >> bitsIn) & mask ) * (255/2047));
     var b=(buffer >> bitsIn) & mask;
     //debug_.push(b);
 
     var pval=t_gamma[b];
     var lb = pval & 0xff;
     var ind=4*offset;
     switch (pval>>8) {
       case 0: 
         dest[ind] = 255;
         dest[ind+1] = 255-lb;
         dest[ind+2] = 255-lb;
         break;
       case 1: 
         dest[ind] = 255;
         dest[ind+1] = lb;
         dest[ind+2] = 0;
         break;
       case 2: 
         dest[ind] = 255-lb;
         dest[ind+1] = 255;
         dest[ind+2] = 0;
         break;
       case 3: 
         dest[ind] = 0;
         dest[ind+1] = 255;
         dest[ind+2] = lb;
         break;
       case 4: 
         dest[ind] = 0;
         dest[ind+1] = 255-lb;
         dest[ind+2] = 255;
         break;
       case 5:
         dest[ind] = 0;
         dest[ind+1] = 0;
         dest[ind+2] = 255-lb;
         break;
       default:
         dest[ind] = 0;
         dest[ind+1] = 0;
         dest[ind+2] = 0;
         break;
     }
     dest[ind+3] = 0xff;
     offset++;
     n--;
   }
   /*
   console.log(" debug: frameposition="+framePosition);
   var str="    rawData: ";
   for (var k=0; k<40; k++) {
     str+=(raw[k]>15?'':'0')+raw[k].toString(16)+" ";
   }
   console.log(str);
   str="     pixels: ";
   for (var k=0; k<40; k++) {
     str+=(debug_[k]>15?'':'0')+debug_[k].toString(16)+" ";
   }
   console.log(str);*/
 };
   

 var old_convertPacked11To16bits=function(raw, dest, framePosition) {
   var offset=Math.floor(framePosition*8/11);
   var vw=11;
   var n=Math.floor(Math.min(raw.length, DEPTH_PKTDSIZE)*8/11);
   var buffer=0;
   var bitsIn=0;
   var srcOffset=0;
   //console.log("  framePosition="+framePosition+" initial pixel="+offset+" initial n="+n+"  raw.length="+raw.length);
   while (n>0) {
     while (bitsIn<vw) {
       buffer = (buffer<<8) | raw[srcOffset++];
       bitsIn+=8;
     }
     bitsIn -= vw;
     var b=Math.floor((buffer >> (bitsIn + vw - 8) ) * (255/2047));
     dest[4*offset] = b;
     dest[4*offset+1] = b;
     dest[4*offset+2] = b;
     dest[4*offset+3] = 0xff;
     offset++;
     n--;
   }
   

/*
   var ri=0,
       di=offset;
   var baseMask = (1 << 11) - 1;
   var length=Math.floor(Math.min(raw.length, DEPTH_PKTDSIZE)*8/11);
   while (ri<length && di*4<dest.length) {
     var r0 = raw[ri+0],
         r1 = raw[ri+1],
         r2 = raw[ri+2],
         r3 = raw[ri+3],
         r4 = raw[ri+4],
         r5 = raw[ri+5],
         r6 = raw[ri+6],
         r7 = raw[ri+7],
         r8 = raw[ri+8],
         r9 = raw[ri+9],
         r10 = raw[ri+10];

     dest[(di+0)*4] = (r0<<3) | (r1>>5);
     dest[(di+1)*4] = ((r1<<6) | (r2>>2) ) & baseMask;
     dest[(di+2)*4] = ((r2<<8) | (r3>>1) | (r4>>7) ) & baseMask;
     dest[(di+3)*4] = ((r4<<4) | (r5>>4) ) & baseMask;
     dest[(di+4)*4] = ((r5<<7) | (r6>>1) ) & baseMask;
     dest[(di+5)*4] = ((r6<<10) | (r7>>2) | (r8>>6) ) & baseMask;
     dest[(di+6)*4] = ((r8<<5) | (r9>>3) ) & baseMask;
     dest[(di+7)*4] = ((r9<<8) | (r10) ) & baseMask;

     for (var pixel=0; pixel<8; pixel++) {
       // fill the other colors
       dest[(di+pixel)*4+1]=dest[(di+pixel)*4+2]=dest[(di+pixel)*4];
       dest[(di+pixel)*4+3]=0xff;  // fill the transparency
     }
     di += 8;
     ri += 11;
   }*/
 };
 
  MotionJS.prototype.processFrame = function(ab) {
    //console.log(this.logIsoPacket(ab.buffer));
    
    convertPacked11To16bits(new Uint8Array(ab.buffer, ab.byteOffset+12, ab.byteLength-12), this.imageData.data, this.framePosition);

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

    var isoInfo = {
      "transferInfo": {
        "direction": DIRECTIONS.inbound,
        "endpoint": CAMERA_ENDPOINTS.depth,
        "length": DEPTH_NUMPKTS*DEPTH_PKTBUF,   // 16*1920
        "data": null
      },
      "packets": DEPTH_NUMPKTS,     // 16
      "packetLength": DEPTH_PKTBUF    // 1920
    };
    if (DEBUG_DATA) this.debugData.push({"timestamp": Date.now(), "device": "camera", "direction": "todevice", "isoinfo": isoInfo});
    if (DEBUG) console.log("[motionjs] sendIsochronous ",isoInfo);
    var _this = this;
    chrome.usb.isochronousTransfer(this.cameraDevice, isoInfo, function(result) {
          //if (DEBUG_DATA) _this.debugData.push({"timestamp": Date.now(), "device": "camera", "direction": "tocomputer", "event": e});
          //if (onCameraEvent) onCameraEvent.call(this, e);
          var offset=0;
          for (var i=0; i<DEPTH_NUMPKTS && offset<result.data.byteLength-DEPTH_PKTBUF; i++, offset+=DEPTH_PKTBUF) {
            _this.processDepthFrame(new Uint8Array(result.data, offset, DEPTH_PKTBUF));
          }
          if (_this.canvasContext && _this.imageData) {
            _this.canvasContext.putImageData(_this.imageData, 0, 0);
          }

          if (DEBUG) console.log("[motionjs] camera event on USB: ",(result.data?("result="+result.resultCode+" data="+logAbFull(result.data)):result)); 
          if (_this.depthStreamEnabled) {
         //   webkitRequestAnimationFrame(function() { _this.requestDepthFrame() });
          }
    });

  }

  MotionJS.prototype.disableDepthStream = function() {
    this.setCameraRegister(0x06, 0x00);
    
    //clear buffer data to work
    this.sendControlAB(this.cameraDevice, DIRECTIONS.inbound, 0, 0, 0, new ArrayBuffer(0x200), null, 0x200);
    this.depthStreamEnabled=false;
  }

  MotionJS.prototype.getDeviceId=function() { 
    return device;
  }

  MotionJS.prototype.isDepthStreamEnabled=function() { 
    return this.depthStreamEnabled;
  }

  MotionJS.prototype.getDebugData=function() {
    return this.debugData;
  }

  MotionJS.prototype.closeDevice=function() {
    chrome.usb.closeDevice(this.cameraDevice);  
    chrome.usb.closeDevice(this.motorDevice);
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

