
var kinect = (function(){

	var vendorId = 0x045e;
	var productId = 0x02B0;
	var deviceId;
	
	var motor_initialized = false;


	var section=document.querySelector("#kinect");
	var logArea=section.querySelector(".log");

	var btnSetLedLight=section.querySelector(".set_led_light");
	var btnHeadUp=section.querySelector(".head_up");
	var btnHeadDown=section.querySelector(".head_down");
  	var leds=section.querySelector(".leds");


	var init=function() {
		//TODO: detect kinect
		flipState(false);
		btnSetLedLight.addEventListener("click", setLedLight);
	    btnHeadUp.addEventListener("click", headUp);
	    btnHeadDown.addEventListener("click", headDown);
	    
	    chrome.experimental.usb.findDevice(vendorId, productId, {"onEvent": onUsbEvent}, findDeviceCallback);
	};
	
	var onUsbEvent=function(e) {
		log("event!");
		log(e);
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
		move_head(0xfff0);
	};
	var headDown = function() {
		move_head(0xffd0);
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
  

	var send_data = function(data) {
		// (bmRequestType, bmRequestType, bmRequest, wValue, wIndex, nBytes)
		var direction = "in";
		
		//chrome.experimental.usb.controlTransfer(integer device, string direction, string recipient, string type,integer request, integer value, integer index, string data, function callback)
		
		logError("Not yet implemented");
	};

	var initialize_motor = function() {
		if (motor_initialized)
			return;
		
		send_data([0xC0, 0x10, 0x0, 0x0, 1]);  // MOTOR INITIALIZE should return 0x22 but dont know why ?
		send_data([0x40, 0x6, 0x1, 0x0, []]); // ???
		motor_initialized = true;
	};
	var move_head = function(angle) {
		/*
			type  request  value                    index   data   length
			 0x40     0x31     2*desired_angle_degrees  0x0     empty  0
			
			//view WARNINGS about angles. The angles is always relative to horizon (equals 0).
		*/
		initialize_motor();
		
		send_data([0x40, 0x31, angle, 0x0, []]); // up 0xfff0 // down 0xffd0 // 2 * angle
		//send_data([0x40, 0x31, 0xffd0, 0x0, []]); // up
		
	};
	var set_led_lights = function(light) {
		send_data([0x40, 0x06, light, 0x0, []]); // up
		
		//request  request  value        index   data   length
		// 0x40     0x06     led_option   0x0     empty  0
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
    