
var usbTest=(function() {

  var section=document.querySelector("#usb");
  var btnLocate=section.querySelector(".locate");
  var btnForget=section.querySelector(".forget");
  var btnBulk=section.querySelector(".bulk");
  var btnControl=section.querySelector(".control");
  var logArea=section.querySelector(".log");

  var deviceId;

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

  var init=function() {
    flipState(true);
    btnLocate.addEventListener("click", findDevice);
    btnForget.addEventListener("click", forgetDevice);
    btnBulk.addEventListener("click", sendBulk);
    btnControl.addEventListener("click", sendControl);
  };

  var flipState=function(deviceLocated) {
    btnLocate.disabled=!deviceLocated;
    btnForget.disabled=deviceLocated;
    btnBulk.disabled=deviceLocated;
    btnControl.disabled=deviceLocated;
  };

  var sendBulk=function() {
    logError("Not yet implemented");
  }

  var sendControl=function() {
    logError("Not yet implemented");
  }

  var findDevice=function() {
    var vendorId=parseInt(section.querySelector(".vendor").value);
    var productId=parseInt(section.querySelector(".product").value);
    if (!vendorId || !productId) {
      logError("Invalid vendorId/productId values");
      return;
    }
    flipState(true);
    chrome.experimental.usb.findDevice(vendorId, productId, {"onEvent": onUsbEvent}, findDeviceCallback);
  };
  
  var onUsbEvent=function(e) {
    log("event!");
	log(e);
  }

  var findDeviceCallback=function(dId) {
    if (!dId) {
      logError("could not find device (deviceId="+dId+")");
    } else {
      deviceId=dId;
      logObj(dId);
      logSuccess("Device found (deviceId="+dId+")");
      flipState(false);
    }
  };

  var forgetDevice=function() {
   deviceId=null;
   flipState(true);
   log("Device forgot");
  };

  return {
    "init": init
  }
})();

usbTest.init();
