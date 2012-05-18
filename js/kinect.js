var retorno_led = function(e) {
	console.log("LED LIGHTS!");
	console.debug(e);
	console.debug(this);
}

/*


var transferInfo = {
	"direction": "in",
	"recipient": "device",
	"requestType": "64",
	"request": 0x06,
	"value": kinect.led_lights.LED_BLINK_YELLOW,
	"index": 0x00
};

chrome.experimental.usb.controlTransfer(deviceId, transferInfo, retorno_led);


"LED_OFF": 0,
"LED_GREEN": 1,
"LED_RED": 2,
"LED_YELLOW": 3, //(actually orange)
"LED_BLINK_YELLOW": 4, //(actually orange)
"LED_BLINK_GREEN": 5,
"LED_BLINK_RED_YELLOW": 6 //(actually red/orange)



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


//request  request  value        index   data   length
// 0x40     0x06     led_option   0x0     empty  0

0x06




var transferInfo = {
	"requestType": "vendor",
	"recipient": "device",
	"direction": "out",
	"request": 0x06,
	"value": 0x06,
	"index": 0x00,
	"data": []
};



chrome.experimental.usb.controlTransfer(deviceId, transferInfo, retorno_led);





*/
var deviceId;


var kinect = (function(){

	var vendorId = 0x045e;
	var productId = 0x02B0;
	//var deviceId;
	
	var motor_initialized = false;


	var section=document.querySelector("#kinect");
	var logArea=section.querySelector(".log");

	var btnSetLedLight=section.querySelector(".set_led_light");
	var btnHeadUp=section.querySelector(".head_up");
	var btnHeadDown=section.querySelector(".head_down");
  	var leds=section.querySelector(".leds");


	var init=function() {
		
		flipState(false);
		btnSetLedLight.addEventListener("click", setLedLight);
	    btnHeadUp.addEventListener("click", headUp);
	    btnHeadDown.addEventListener("click", headDown);
	    
	    chrome.experimental.usb.findDevice(vendorId, productId, {"onEvent": onUsbEvent}, findDeviceCallback);
	};
	
	var onUsbEvent=function(e) {
		log("event! (inspect on console)");
		logObj(e);
	}

	var findDeviceCallback=function(dId) {
		if (!dId) {
			logError("could not find device (deviceId="+dId+")");
			flipState(false);
		} else {
			deviceId=dId;
			logObj(dId);
			logSuccess("Device found (deviceId="+dId+")");
			flipState(true);
		}
	};


	var flipState=function(deviceLocated) {
		btnSetLedLight.disabled=!deviceLocated;
		btnHeadUp.disabled=!deviceLocated;
		btnHeadDown.disabled=!deviceLocated;
		leds.disabled=!deviceLocated;
	};

	
	var setLedLight = function() {
		var led_color=leds.options[leds.options.selectedIndex].value;
		log("setting led light to " + led_color);
	    set_led_lights(led_lights[led_color]);
	};
	var headUp = function() {
		move_head(0x10);
	};
	var headDown = function() {
		move_head(0xfff8);
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
		device ( integer )
			A device handle on which the transfer is to be made.
		direction ( string )
			The direction of the control transfer. "in" for an inbound transfer, "out" for an outbound transfer.
		recipient ( string )
			The intended recipient of this message. Must be one of "device", "interface", "endpoint" or "other".
		type ( string )
			The type of this request. Must be one of "standard", "class", "vendor" or "reserved".
		request ( integer )
		value ( integer )
		index ( integer )
		data ( string )
			(TODO(gdk): ArrayBuffer) The data payload carried by this transfer.
		callback ( optional function )
			An optional callback that is invoked when this transfer completes.
		
		Callback function
			If you specify the callback parameter, it should specify a function that looks like this:
			function(object result) {...};
			result ( object )
				data ( optional string )
					(TODO(gdk): ArrayBuffer) If the transfer is inbound, then this field is populated with the data transferred from the device.
				result ( integer )
					On success, 0 is returned. On failure, -1.
		
	*/
	var send_control = function(request, value, index, data) {
		var transferInfo = {
			"requestType": "vendor",
			"recipient": "device",
			"direction": "out",
			"request": request,
			"value": value,
			"index": index,
			"data": data
                };
		chrome.experimental.usb.controlTransfer(deviceId, transferInfo);
	};

	var initialize_motor = function() {
		if (motor_initialized)
			return;
		
		//send_control(0xC0, 0x10, 0x0, 0x0, [1]);  // MOTOR INITIALIZE should return 0x22
		//send_control(0x40, 0x6, 0x1, 0x0, [0]); // ???
		motor_initialized = true;
	};

	var move_head = function(angle) {
		/*
			type  request  value                    index   data   length
			 0x40     0x31     2*desired_angle_degrees  0x0     empty  0
			
			//view WARNINGS about angles. The angles is always relative to horizon (equals 0).
		*/
		initialize_motor();
		send_control(0x31, 2*angle, 0, [0]); 
		
	};
	var get_led_lights = function(e) {
		log("LED LIGHTS!");
		logObj(e);
		logObj(this);
	}
	var set_led_lights = function(light) {
		//send_data([0x40, 0x06, light, 0x0, []]); // up
		//chrome.experimental.usb.controlTransfer(deviceId.handle, "in", "device", 0x40, 0x06, light, 0x0, null, get_led_lights);
		
		//request  request  value        index   data   length
		// 0x40     0x06     led_option   0x0     empty  0
		
		var transferInfo = {
			"requestType": "vendor",
			"recipient": "device",
			"direction": "out",
			"request": 0x06,
			"value": light,
			"index": 0x00,
			"data": [0]  // need to send something on data array, otherwise chrome on linux crashes!!!
		};
		chrome.experimental.usb.controlTransfer(deviceId, transferInfo);

	}
	
	var get_accel = function() {
		var result = {};
		
		//ctrl_transfer
		var ret = send_data([0xC0, 0x32, 0x0, 0x0, 10]); 
		
		/*
			request  request  value  index   data    length
			 0xC0     0x32     0x0    0x0     buf     10
			
			The joint state information is grouped in with the accelerometer data and is stored in the 8th and 9th byte
		*/
		
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
		return result;
	};
	
	/*
	
	*/
	var led_lights = {
		"LED_OFF": 0,
		"LED_GREEN": 1,
		"LED_RED": 2,
		"LED_YELLOW": 3, //(actually orange)
		"LED_BLINK_YELLOW": 4, //(actually orange)
		"LED_BLINK_GREEN": 5,
		"LED_BLINK_RED_YELLOW": 6 //(actually red/orange)
	}

	return {
		"init": init,
		"move_head": move_head,
		"led_lights": led_lights,
		"set_led_lights": set_led_lights,
		"get_accel": get_accel
	}
	
})();


kinect.init();
