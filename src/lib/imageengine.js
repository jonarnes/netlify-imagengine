import { JSDOM } from 'jsdom'
import { OBJECT_TO_DIRECTIVES_MAP, build_IE_url } from '@imageengine/imageengine-helpers';

export async function updateHtmlImagesToImageEngine(html, options) {
  const {
    deliveryAddress,
    directives
  } = options

  const errors = []
  const dom = new JSDOM(html)

  // Loop through all images found in the DOM and swap the source with
  // a ImageEngine URL
  if(dom != null){
    const images = Array.from(dom.window.document.querySelectorAll('img'))
    for (const $img of images) {
      const imgSrc = $img.getAttribute('src')
      if(imgSrc.length > 1 && !isImageEngineURL(imgSrc,deliveryAddress)){
        let transformedSrc = "";
        transformedSrc = transformSrcURL(imgSrc,deliveryAddress);
        if(transformedSrc.length > 1){
          let ie_directives = directives != null ? directives : [];
          let ieURL = build_IE_url(transformedSrc,ie_directives)

          $img.setAttribute('src', ieURL)
        }
      }    
    }  
    return {
      html: dom.serialize(),
      errors,
    }
  }
}
export function transformSrcURL(orgURL,deliveryAddress ){
  let finalSrc = ""
  if(isRemoteURL(orgURL)){  
    let srcURL = orgURL.split("://");
    if(srcURL.length > 1){
      let urlPrefix = srcURL[0]; 
      let srcArray = srcURL[1].split("/");
      let length = srcArray.length;
      let imageName = srcArray[length -1];
      finalSrc = urlPrefix + "://" + deliveryAddress + '/' + imageName;
    }
  }
  else{
    let srcArray = orgURL.split("/");
    let length = srcArray.length;
    let imageName = srcArray[length -1];
    finalSrc = deliveryAddress + '/' + imageName;
  }
  return finalSrc;
}

export function isRemoteURL(orgURL){
  return orgURL.startsWith('https') || orgURL.startsWith('http')
}

export function isImageEngineURL(orgURL,deliveryAddress){
    let isImageEngineURL = false
    if(orgURL.length > 1 && deliveryAddress.length > 1 && orgURL.includes(deliveryAddress)){
        return true
    }
    return isImageEngineURL;
}
