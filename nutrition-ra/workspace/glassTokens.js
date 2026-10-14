/** Clear optical map profile. Reuses the shared renderer; does not create a second engine. */
export const GLASS_MAP_OPTICS=Object.freeze({zRadius:20,refraction:.58,chromAberration:.022,edgeHighlight:.09,fresnel:.75,saturation:.75,tintStrength:0,tintColor:Object.freeze([1,1,1]),brightness:0,shadowOpacity:.12,shadowSpread:8});
export const GLASS_MAP_LAYOUT=Object.freeze({phoneMax:600,tabletMax:1100,edge:16,phoneEdge:8,headerTop:90,phoneTop:74,touchTarget:44});
export const GLASS_BLUR=Object.freeze({min:0,max:24,step:1,default:0});
