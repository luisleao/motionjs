
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
    window.motionjs = motionjs;

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
    document.getElementById("_createlog").addEventListener("click", function() {
      createLog();
    });

  };

  var createLog = function() {
    var errorHandler=function(e) {
      var msg = '';

      switch (e.code) {
        case FileError.QUOTA_EXCEEDED_ERR:
          msg = 'QUOTA_EXCEEDED_ERR';
          break;
        case FileError.NOT_FOUND_ERR:
          msg = 'NOT_FOUND_ERR';
          break;
        case FileError.SECURITY_ERR:
          msg = 'SECURITY_ERR';
          break;
        case FileError.INVALID_MODIFICATION_ERR:
          msg = 'INVALID_MODIFICATION_ERR';
          break;
        case FileError.INVALID_STATE_ERR:
          msg = 'INVALID_STATE_ERR';
          break;
        default:
          msg = 'Unknown Error';
          break;
      };

      console.log('Error: ' + msg);
    };

    var onInitFs=function(fs) {

      fs.root.getFile('log_'+Date.now()+'.txt', {create: true}, function(fileEntry) {
        fileEntry.createWriter(function(fileWriter) {

          fileWriter.onwriteend = function(e) {
            console.log('Write completed.');
            document.getElementById("logfile").style.visibility="visible";
            document.getElementById("logfile").href=fileEntry.toURL();
            document.getElementById("logfile").setAttribute("download", "log.txt");
          };

          fileWriter.onerror = function(e) {
            console.error('Write failed: ' + e.toString());
          };

          // // Create a new Blob and write it to log.bin.
          var blob = new Blob([JSON.stringify(motionjs.getDebugData())], {type: 'text/plain'});

          fileWriter.write(blob);
        }, errorHandler);

      }, errorHandler);

    };

    window.webkitRequestFileSystem(window.TEMPORARY, 5*1024*1024*1024, onInitFs, errorHandler);
  }

  var onFindDevice = function(e){
    animateAction();
    motionjs.findDevice(null, null, findDeviceCallback, findDeviceCallback);
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

  var findDeviceCallback=function(dId) {
    if (!dId) {
      logError("could not find device (deviceId="+dId+")");
      flipState(false);
    } else {
      deviceId=dId;
      logSuccess("Device found (deviceId="+JSON.stringify(dId)+")");
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
