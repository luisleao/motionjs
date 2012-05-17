
var serialTest=(function() {

  var section=document.querySelector("#serial");
  var btnOpen=section.querySelector(".open");
  var btnWrite=section.querySelector(".write");
  var btnClose=section.querySelector(".close");
  var logArea=section.querySelector(".log");
  var ports=section.querySelector(".ports");

  var connectionInfo;

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
    btnOpen.addEventListener("click", openSerial);
    btnWrite.addEventListener("click", writeSerial);
    btnClose.addEventListener("click", closeSerial);
    section.querySelector(".refresh").addEventListener("click", refreshPorts);
    refreshPorts();
  };

  var flipState=function(deviceLocated) {
    btnOpen.disabled=!deviceLocated;
    btnWrite.disabled=deviceLocated;
    btnClose.disabled=deviceLocated;
  };

  var refreshPorts=function() {
    //ports.options=[];
	while (ports.options.length > 0)
		ports.options.remove(0);
	
    chrome.experimental.serial.getPorts(function(items) {
      logSuccess("got "+items.length+" serial ports");
      for (var i=0; i<items.length; i++) {
        ports.options.add(new Option(items[i], items[i]));
      };
    });
  };

  var openSerial=function() {
    var serialPort=ports.options[ports.options.selectedIndex].value;
    if (!serialPort) {
      logError("Invalid serialPort");
      return;
    }
    flipState(true);
    chrome.experimental.serial.open(serialPort, onOpen);
  };

  var onOpen=function(cInfo) {
    if (!cInfo || !cInfo.connectionId || cInfo.connectionId<0) {
      logObj(cInfo);
      logError("could not find device (connectionInfo="+cInfo+")");
    } else {
      connectionInfo=cInfo;
      logObj(cInfo);
      logSuccess("Device found (connectionId="+cInfo.connectionId+")");
      flipState(false);
      chrome.experimental.serial.read(connectionInfo.connectionId, onRead); 
    }
  };

  var writeSerial=function() {
    var writeString=section.querySelector(".writeString").value;
    if (!writeString) {
      logError("Nothing to write");
      return;
    }
    chrome.experimental.serial.write(connectionInfo.connectionId, writeString, onWrite); 
  }

  var onWrite=function() {
    logSuccess("Write successfully");
  }

  var onRead=function(readInfo) {
    logObj(readInfo);
    log("Read from serial: "+readInfo.message);
  }

  var closeSerial=function() {
   chrome.experimental.serial.close(connectionInfo.connectionId, onClose);
  };
  
  var onClose = function(result) {
   log("Serial port closed");
   connectionInfo=null;
   flipState(false);
  }


  return {
    "init": init
  }
})();

serialTest.init();
