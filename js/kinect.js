
var kinect = (function(){
  //TODO: specific product ids for camera, audio and motor/accelerometer
  
  var vendorId = 0x045e;
  var motor_productId = 0x02B0;   // motor
  var camera_productId = 0x02Ae;    // camera
  var tmr_accel;

  var motionjs;
  
  var accel;
  var motor_initialized = false;


  var section=document.querySelector("#kinect");
  var logArea=section.querySelector(".log");

  var btnInit=section.querySelector(".init");
  var btnHeadUp=section.querySelector(".head_up");
  var btnHeadDown=section.querySelector(".head_down");
  var btnDepthStream=section.querySelector(".enable-depth");
  var leds=section.querySelectorAll(".led");

  var init=function() {
    motionjs=new MotionJS();
    for (var i=0; i<leds.length; i++) {
      leds[i].addEventListener("click", setLedLight);
    }
    flipState(false);
    btnHeadUp.addEventListener("click", headUp);
    btnHeadDown.addEventListener("click", headDown);
    btnDepthStream.addEventListener("click", swapDepthStream);
    btnInit.addEventListener("click", onFindDevice);
    _testsend.addEventListener("click", function() {
      motionjs.requestDepthFrame();
    });

  };

  var onFindDevice = function(e){
    animateAction();
    motionjs.findDevice(onUsbEvent, onUsbEvent, findDeviceCallback, findDeviceCallback);
  };

  
  var animateAction=function() {
    var eye1=section.querySelector("#eye1");
    var eye2=section.querySelector("#eye2");
    eye1.className="show";
    eye2.className="show";
    eye1.addEventListener("webkitAnimationEnd", function(e) {
      e.target.className="";
    });
    eye2.addEventListener("webkitAnimationEnd", function(e) {
      e.target.className="";
    });
  };

  var onUsbEvent=function(e) {
    
    /*
    when receiving accelerometer data:
    
    the 8th byte (buf[8]) yields:
     positive_angle_degrees = value/2
     negative_angle_degrees = (255-value)/2

    buf[8] = 0x80 if the kinect is moving (buf[9] is usually 0x04, but sometimes 0x00)
    Please note that this is not the angle of the motor, this is the angle of the kinect itself in degrees (basically accelerometer data translated)

    the 9th byte (buf[9]) yields the following status codes:
     0x0 - stopped
     0x1 - reached limits
     0x4 - moving
    */
    if (e.data && e.data.length == 10) {
       console.log("[kinect] accelerometer event.");
      
      /*
      
      var x = (e.data[2] << 8) | e.data[3];
      x = (x + Math.pow(2,15)) % Math.pow(2,16) - Math.pow(2,15);  //# convert to signed 16b
      
      var y = (e.data[4] << 8) | e.data[5];
      y = (y + Math.pow(2,15)) % Math.pow(2,16) - Math.pow(2,15);  //# convert to signed 16b
      
      var z = (e.data[6] << 8) | e.data[7];
      z = (x + Math.pow(2,15)) % Math.pow(2,16) - Math.pow(2,15);  //# convert to signed 16b
      
      if (DEBUG) { console.log("[motionjs] accelerometer [" +x+ ", " +y+ ", " +z+ "]") };

      
      x = (ret[2] << 8) | ret[3]
      x = (x + Math.pow(2,15)) % Math.pow(2,16) - Math.pow(2,15)     # convert to signed 16b
      y = (ret[4] << 8) | ret[5]
      y = (y + Math.pow(2,15)) % Math.pow(2,16) - Math.pow(2,15)     # convert to signed 16b
      z = (ret[6] << 8) | ret[7]
      z = (x + Math.pow(2,15)) % Math.pow(2,16) - Math.pow(2,15)     # convert to signed 16b

      print x, "\t", y, "\t", z
      
      moving sample
      0: 64, 1: 49, 2: 236, 3: 255, 4: 0, 5: 0, 6: 10, 7: 0, 8: 0, 9: 0
      0: 64, 1: 49, 2: 20, 3: 0, 4: 0, 5: 0, 6: 10, 7: 0, 8: 0, 9: 0
      
      normal condition sample
      0: 192, 1: 50, 2: 0, 3: 0, 4: 0, 5: 0, 6: 10, 7: 0, 8: 0, 9: 0
      
      */
      
    } else {
    //  logObj(e);
    }
    
  };

  var findDeviceCallback=function(dId) {
    if (!dId) {
      logError("could not find device (deviceId="+dId+")");
      flipState(false);
    } else {
      deviceId=dId;
      logSuccess("Device found (deviceId="+dId+")");
//      tmr_accel = setInterval(get_accel, 1000);
      flipState(true);
    }
  };


  var flipState=function(deviceLocated) {
    btnInit.disabled=deviceLocated;
    for (var i=0; i<leds.length; i++) {
      leds[i].disabled=!deviceLocated;
    }
    btnHeadUp.disabled=!deviceLocated;
    btnHeadDown.disabled=!deviceLocated;
    btnDepthStream.disabled=!deviceLocated;
    
  };

  
  var setLedLight = function(e) {
    animateAction();
    var led_colorname=e.target.value;
    log("setting led light to " + led_colorname);
    motionjs.setLed(led_colorname);
  };

  var headUp = function() {
    animateAction();
    motionjs.moveHead(10);
  };

  var headDown = function() {
    animateAction();
    motionjs.moveHead(-10);
  };

  var swapDepthStream = function() {
    if (motionjs.isDepthStreamEnabled()) {
      btnDepthStream.textContent="Off";
      btnDepthStream.className="enable-depth";
      motionjs.disableDepthStream();
    } else {
      btnDepthStream.textContent="On";
      btnDepthStream.className="enable-depth on";
      motionjs.enableDepthStream();
    }
  }

  var logObj=function(obj) {
    console.log(obj);
  }
  var logSuccess=function(msg) {
    log("<span style='color: green;'>"+msg+"</span>");
  };
  var logError=function(msg) {
    log("<span style='color: red;'>"+msg+"</span>");
  };
  var log=function(msg) {
    logArea.innerHTML=msg+"<br/>"+logArea.innerHTML;
    
  };
  


  /*
  
  0x80  (LIBUSB_REQUEST_TYPE_STANDARD | LIBUSB_RECIPIENT_DEVICE | LIBUSB_ENDPOINT_IN)
  0x40  (LIBUSB_REQUEST_TYPE_VENDOR   | LIBUSB_RECIPIENT_DEVICE | LIBUSB_ENDPOINT_OUT)
  0xc0  (LIBUSB_REQUEST_TYPE_VENDOR   | LIBUSB_RECIPIENT_DEVICE | LIBUSB_ENDPOINT_IN)
  
  */


/*
  var initialize_motor = function() {
    if (motor_initialized)
      return;
    
    //send_control(0xC0, 0x10, 0x0, 0x0, [1]);  // MOTOR INITIALIZE should return 0x22
    //send_control(0x40, 0x6, 0x1, 0x0, [0]); // ???
    get_control(0x10, 0, 0, [0], 1);
    motor_initialized = true;
  };
*/

//  var get_accel = function() {
    /*
      request  request  value  index   data    length
       0xC0     0x32     0x0    0x0     buf     10
      The joint state information is grouped in with the accelerometer data and is stored in the 8th and 9th byte
    */
    //get_control(0x32, 0, 0, [0,0,0,0,0,0,0,0,0,0], 10);
    
    /*
    //    #print map(hex, ret)
    
    # bytes 0 & 1 are always zero

      x = (ret[2] << 8) | ret[3]
      x = (x + 2**15) % 2**16 - 2**15     # convert to signed 16b
      y = (ret[4] << 8) | ret[5]
      y = (y + 2**15) % 2**16 - 2**15     # convert to signed 16b
      z = (ret[6] << 8) | ret[7]
      z = (z + 2**15) % 2**16 - 2**15     # convert to signed 16b

      print x, "\t", y, "\t", z
    */
//  };

  return {
    "init": init,
  }
  
})();


kinect.init();
