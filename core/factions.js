/* Single canonical faction identity and presentation settings for every map. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameFactions=api;
 if(typeof document!=='undefined'&&document.documentElement){
  document.documentElement.style.setProperty('--hex-german-entry',api.reinforcements.german.color);
  document.documentElement.style.setProperty('--hex-soviet-entry',api.reinforcements.soviet.color);
 }
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const reinforcements=Object.freeze({german:Object.freeze({color:'#08004cff',width:20.0}),soviet:Object.freeze({color:'#eb1b16',width:20.0})});
 // Common physical geometry for Star and Iron Cross in all campaigns.
 const deploymentIcons=Object.freeze({scale:0.86,crowdedScale:0.70,pairSpacing:19,bottomCenterFraction:0.42,opacity:1});
 return Object.freeze({reinforcements,deploymentIcons});
});
