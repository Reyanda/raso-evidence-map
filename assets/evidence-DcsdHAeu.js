(function(){const r=document.createElement("link").relList;if(r&&r.supports&&r.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))i(a);new MutationObserver(a=>{for(const s of a)if(s.type==="childList")for(const n of s.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&i(n)}).observe(document,{childList:!0,subtree:!0});function t(a){const s={};return a.integrity&&(s.integrity=a.integrity),a.referrerPolicy&&(s.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?s.credentials="include":a.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function i(a){if(a.ep)return;a.ep=!0;const s=t(a);fetch(a.href,s)}})();const ye=Object.freeze({zRadius:20,refraction:.58,chromAberration:.022,edgeHighlight:.09,fresnel:.75,saturation:.75,tintStrength:0,tintColor:Object.freeze([1,1,1]),brightness:0,shadowOpacity:.12,shadowSpread:8}),we=Object.freeze({min:0,max:24,step:1,default:0});var Re={blurAmount:0,refraction:.69,chromAberration:.05,edgeHighlight:.05,specular:0,fresnel:1,distortion:0,cornerRadius:65,zRadius:40,opacity:1,saturation:0,tintStrength:0,brightness:0,shadowOpacity:.3,shadowSpread:10,shadowOffsetY:1,floating:!1,button:!1,bevelMode:0},Se=6,Te=20,ce=`
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
	v_uv = a_pos * 0.5 + 0.5;
	gl_Position = vec4(a_pos, 0.0, 1.0);
}`,Ee=`
precision mediump float;
uniform sampler2D u_tex;
uniform vec2 u_scale;
uniform vec2 u_offset;
varying vec2 v_uv;
void main() {
	gl_FragColor = texture2D(u_tex, v_uv * u_scale + u_offset);
}`,Ae=`
precision mediump float;
uniform sampler2D u_tex;
uniform vec2 u_dir;
varying vec2 v_uv;
void main() {
	vec4 s  = texture2D(u_tex, v_uv) * 0.227027;
	s += texture2D(u_tex, v_uv + u_dir * 1.0) * 0.194594;
	s += texture2D(u_tex, v_uv - u_dir * 1.0) * 0.194594;
	s += texture2D(u_tex, v_uv + u_dir * 2.0) * 0.121622;
	s += texture2D(u_tex, v_uv - u_dir * 2.0) * 0.121622;
	s += texture2D(u_tex, v_uv + u_dir * 3.0) * 0.054054;
	s += texture2D(u_tex, v_uv - u_dir * 3.0) * 0.054054;
	s += texture2D(u_tex, v_uv + u_dir * 4.0) * 0.016216;
	s += texture2D(u_tex, v_uv - u_dir * 4.0) * 0.016216;
	gl_FragColor = s;
}`,Pe=`
attribute vec2 a_pos;
uniform vec2 u_center;   // panel centre in root-pixel coords (top-left origin)
uniform vec2 u_size;     // panel size in px
uniform vec2 u_res;      // root element size in px
uniform float u_pad;     // shadow padding in px
varying vec2 v_localPx;
varying vec2 v_screenUV;

void main() {
	vec2 total = u_size + vec2(u_pad * 2.0);
	v_localPx = a_pos * total;                       // px from panel centre
	vec2 px = u_center + a_pos * total;              // screen px (DOM)
	v_screenUV = vec2(px.x / u_res.x, 1.0 - px.y / u_res.y);
	vec2 ndc = (px / u_res) * 2.0 - 1.0;
	ndc.y = -ndc.y;
	gl_Position = vec4(ndc, 0.0, 1.0);
}`,ke=`
precision highp float;

uniform sampler2D u_bgTex;
uniform sampler2D u_blurTex;
uniform vec2 u_size;           // panel px
uniform float u_radius;        // corner radius px
uniform vec2 u_res;

uniform float u_refract;
uniform float u_chroma;
uniform float u_edgeHL;
uniform float u_spec;
uniform float u_fresnel;
uniform float u_distort;
uniform float u_alpha;
uniform float u_sat;
uniform float u_tint;
uniform vec3 u_tintColor;
uniform float u_zRadius;
uniform float u_brightness;
uniform float u_shadowAlpha;
uniform float u_shadowSpread;
uniform float u_shadowOffY;
uniform float u_bevelMode;

varying vec2 v_localPx;
varying vec2 v_screenUV;

// Rounded-rect signed distance
float rrSDF(vec2 p, vec2 b, float r) {
	vec2 q = abs(p) - b + vec2(r);
	return min(max(q.x, q.y), 0.0) + length(max(q, vec2(0.0))) - r;
}

// Bevel height field.
// Both modes use the same half-circle profile (smooth peak at centre,
// steep at edges).  The difference is in the refraction model:
//   mode 0 = biconvex pill — light refracts at both surfaces (entry + exit).
//   mode 1 = dome (plano-convex) — flat bottom, so only exit refraction.
// d = distance inside from edge (-sdf), zR = z-radius of the bevel.
float bevelHeight(float d, float zR) {
	if (d <= 0.0) return 0.0;
	if (d >= zR) return zR;
	return sqrt(d * (2.0 * zR - d));
}

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
	vec2 half_ = u_size * 0.5;
	float r = min(u_radius, min(half_.x, half_.y));
	float sdf = rrSDF(v_localPx, half_, r);

	// ── Shadow (outside panel, offset by shadowOffY) ──
	if (sdf > 0.0) {
		float sdfShadow = rrSDF(v_localPx - vec2(0.0, u_shadowOffY), half_, r);
		float d = max(sdfShadow - 1.0, 0.0);
		float spread = max(u_shadowSpread, 1.0);
		float falloff = 1.0 / (spread * spread);
		float outerShadow = exp(-d * d * falloff) * 0.65;
		float contactShadow = exp(-d * 0.08 / max(spread * 0.04, 0.01)) * 0.35;
		float shadow = (outerShadow + contactShadow) * u_shadowAlpha;
		gl_FragColor = vec4(0.0, 0.0, 0.0, shadow);
		return;
	}

	// ── Anti-aliased mask ──
	float mask = 1.0 - smoothstep(-1.5, 0.5, sdf);

	float maxD = min(half_.x, half_.y);
	float inside = -sdf;
	float edge = smoothstep(maxD * 0.35, 0.0, inside);

	// ── Surface normal (top surface) via bevel height field ──
	float zR = u_zRadius;
	float e = 2.0;
	float dC = inside;
	float dR = -rrSDF(v_localPx + vec2(e, 0.0), half_, r);
	float dL = -rrSDF(v_localPx - vec2(e, 0.0), half_, r);
	float dU = -rrSDF(v_localPx + vec2(0.0, e), half_, r);
	float dD = -rrSDF(v_localPx - vec2(0.0, e), half_, r);
	float hC = bevelHeight(dC, zR);
	float hR = bevelHeight(dR, zR);
	float hL = bevelHeight(dL, zR);
	float hU = bevelHeight(dU, zR);
	float hD = bevelHeight(dD, zR);
	vec2 hGrad = vec2(hR - hL, hU - hD) / (2.0 * e);
	vec3 N = normalize(vec3(-hGrad, 1.0));

	float depth = smoothstep(0.0, zR, inside);

	// ── Refraction ──
	vec2 pxToUV = vec2(1.0, -1.0) / u_res;
	float ior = 1.5;
	float refrPow = 1.0 - 1.0 / ior;
	float thickness = hC * 2.0;
	float thickNorm = thickness / max(zR * 2.0, 1.0);
	vec2 refrPx;
	if (u_bevelMode < 0.5) {
		// Biconvex: physically-based dual-surface refraction
		vec2 exitRefr = hGrad * refrPow;
		vec2 entryRefr = hGrad * refrPow;
		vec2 throughRefr = entryRefr * thickNorm * 0.5;
		refrPx = (exitRefr + entryRefr + throughRefr) * u_refract * 30.0;
		vec2 centerDir = -v_localPx / max(half_, vec2(1.0));
		refrPx += centerDir * u_refract * 4.0 * depth;
	} else {
		// Dome (plano-convex): uniform magnification by contracting UV toward center.
		// Each pixel samples from closer to center → content appears larger.
		refrPx = -v_localPx * u_refract * depth * 0.35;
	}
	vec2 refr = refrPx * pxToUV;

	// ── Micro-distortion noise ──
	vec2 ns = v_localPx * 0.08;
	vec2 absPxToUV = vec2(1.0) / u_res;
	vec2 micro = (vec2(hash(ns), hash(ns + vec2(37.0))) - 0.5) * u_distort * 4.0 * absPxToUV;

	// ── Chromatic aberration ──
	float caS = u_chroma * 18.0 * (edge * 0.7 + 0.3) * 2.0;
	vec2 caD = N.xy * caS * pxToUV;
	vec2 base = v_screenUV + refr + micro;

	vec3 sharp = vec3(
		texture2D(u_bgTex,  base + caD).r,
		texture2D(u_bgTex,  base).g,
		texture2D(u_bgTex,  base - caD).b
	);
	vec3 blur = vec3(
		texture2D(u_blurTex, base + caD).r,
		texture2D(u_blurTex, base).g,
		texture2D(u_blurTex, base - caD).b
	);
	// ── Edge-weighted blur mix ──
	// Centre of the panel uses the blurred sample; the rim blends
	// toward the sharp sample so refraction edges stay crisp.
	float edgeMix = (1.0 - edge * 0.15);
	vec3 col = mix(sharp, blur, edgeMix);

	// ── Brightness ──
	col *= 1.0 + u_brightness;

	// ── Saturation ──
	float lum = dot(col, vec3(0.299, 0.587, 0.114));
	col = mix(vec3(lum), col, 1.0 + u_sat);

	// ── Cool glass tint ──
	// Coloured glass absorbs more light through the curved, thicker rim.
	float absorption = u_tint * (0.035 + 1.6 * pow(1.0 - abs(N.z), 1.4));
	col *= mix(vec3(1.0), u_tintColor, clamp(absorption, 0.0, 0.82));
	col *= 1.0 + 0.06 * depth;

	// ── Fresnel ──
	float fres = pow(1.0 - abs(N.z), 4.0) * u_fresnel;

	// ── Specular highlights (multi-light Blinn-Phong) ──
	vec3 V = vec3(0.0, 0.0, 1.0);
	vec3 L1 = normalize(vec3(0.4, 0.7, 1.0));
	vec3 H1 = normalize(L1 + V);
	float sp1 = pow(max(dot(N, H1), 0.0), 90.0);
	vec3 L2 = normalize(vec3(-0.3, -0.5, 1.0));
	vec3 H2 = normalize(L2 + V);
	float sp2 = pow(max(dot(N, H2), 0.0), 50.0) * 0.3;
	vec3 L3 = normalize(vec3(0.1, 0.3, 1.0));
	float spB = pow(max(dot(N, L3), 0.0), 6.0) * 0.1;
	vec3 L4 = normalize(vec3(0.0, 0.9, 0.4));
	vec3 H4 = normalize(L4 + V);
	float sp4 = pow(max(dot(N, H4), 0.0), 120.0) * 0.6;
	float totalSpec = (sp1 + sp2 + spB + sp4) * u_spec;

	// ── Inner border / stroke highlight ──
	float borderWidth = 1.5;
	float innerStroke = smoothstep(-borderWidth - 1.0, -borderWidth, sdf)
	                  * (1.0 - smoothstep(-1.0, 0.0, sdf));
	float topBias = 0.5 + 0.5 * (-v_localPx.y / half_.y);
	innerStroke *= (0.4 + 0.6 * topBias);

	// ── Edge highlight & inner glow ──
	float rim = edge * u_edgeHL * 0.22;
	float innerGlow = smoothstep(5.0, 0.0, -sdf) * u_edgeHL * 0.15;

	// ── Environment-like reflection (fake) ──
	float envRefl = (N.y * 0.5 + 0.5) * fres * 0.08;

	// ── Composite ──
	vec3 fin = col;
	fin += vec3(totalSpec);
	fin += vec3(rim + innerGlow);
	fin += vec3(innerStroke * u_edgeHL * 0.55);
	fin += vec3(envRefl);
	fin = mix(fin, vec3(1.0), fres * 0.2);

	gl_FragColor = vec4(fin, mask * u_alpha);
}`,Me=class{constructor(){this.fboCache=new Map,this.activeFBOs=null,this.bgTex=null,this.width=0,this.height=0,this.contextLost=!1,this.canvas=document.createElement("canvas"),this.canvas.style.display="none",document.body.appendChild(this.canvas),this.cropCanvas=document.createElement("canvas"),this.cropCtx=this.cropCanvas.getContext("2d");const e=this.canvas.getContext("webgl",{alpha:!0,premultipliedAlpha:!1,antialias:!1,preserveDrawingBuffer:!0});if(!e)throw new Error("LiquidGlass: WebGL is not supported in this browser.");this.gl=e,this._initPrograms(),this._initBuffers(),this._onContextLost=r=>{r.preventDefault(),this.contextLost=!0,console.warn("LiquidGlass: WebGL context lost.")},this._onContextRestored=()=>{console.info("LiquidGlass: WebGL context restored — reinitialising."),this.contextLost=!1,this._initPrograms(),this._initBuffers();for(const r of this.fboCache.values())this._freeFBOSet(r);this.fboCache.clear(),this.activeFBOs=null,this.bgTex=null},this.canvas.addEventListener("webglcontextlost",this._onContextLost),this.canvas.addEventListener("webglcontextrestored",this._onContextRestored)}_initPrograms(){this.blitP=this._link(ce,Ee),this.blitU=this._uloc(this.blitP,["u_tex","u_scale","u_offset"]),this.blurP=this._link(ce,Ae),this.blurU=this._uloc(this.blurP,["u_tex","u_dir"]),this.glassP=this._link(Pe,ke),this.glassU=this._uloc(this.glassP,["u_bgTex","u_blurTex","u_center","u_size","u_radius","u_res","u_pad","u_refract","u_chroma","u_edgeHL","u_spec","u_fresnel","u_distort","u_alpha","u_sat","u_tint","u_tintColor","u_zRadius","u_brightness","u_shadowAlpha","u_shadowSpread","u_shadowOffY","u_bevelMode"])}_initBuffers(){const e=this.gl;this.quadBuf=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.quadBuf),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),e.STATIC_DRAW),this.panelBuf=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.panelBuf),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-.5,-.5,.5,-.5,-.5,.5,.5,.5]),e.STATIC_DRAW)}resize(e,r){this.width=e,this.height=r;for(const t of this.fboCache.values())this._freeFBOSet(t);this.fboCache.clear(),this.activeFBOs=null,this.canvas.width=0,this.canvas.height=0}uploadAndBlur(e,r,t,i,a,s){if(this.contextLost)return;const n=this.gl;if(!this._setActiveSize(i,a))return;const u=this.width,v=this.height,h=this.activeFBOs;this.cropCanvas.width=u,this.cropCanvas.height=v,this.cropCtx.clearRect(0,0,u,v),this.cropCtx.drawImage(e,-r,-t),this.bgTex||(this.bgTex=n.createTexture()),n.bindTexture(n.TEXTURE_2D,this.bgTex),n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,!0),n.texImage2D(n.TEXTURE_2D,0,n.RGBA,n.RGBA,n.UNSIGNED_BYTE,this.cropCanvas),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MIN_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MAG_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_S,n.CLAMP_TO_EDGE),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_T,n.CLAMP_TO_EDGE),n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,!1),n.bindFramebuffer(n.FRAMEBUFFER,h.bg.fbo),n.viewport(0,0,u,v),n.useProgram(this.blitP),n.activeTexture(n.TEXTURE0),n.bindTexture(n.TEXTURE_2D,this.bgTex),n.uniform1i(this.blitU.u_tex,0),n.uniform2f(this.blitU.u_scale,1,1),n.uniform2f(this.blitU.u_offset,0,0),this._drawQuad(this.blitP,this.quadBuf);const w=h.blurA.w,P=h.blurA.h;if(n.bindFramebuffer(n.FRAMEBUFFER,h.blurA.fbo),n.viewport(0,0,w,P),n.bindTexture(n.TEXTURE_2D,h.bg.tex),this._drawQuad(this.blitP,this.quadBuf),s>0){const se=s*2.5;n.useProgram(this.blurP),n.uniform1i(this.blurU.u_tex,0);for(let le=0;le<Se;le++)n.bindFramebuffer(n.FRAMEBUFFER,h.blurB.fbo),n.viewport(0,0,w,P),n.bindTexture(n.TEXTURE_2D,h.blurA.tex),n.uniform2f(this.blurU.u_dir,se/w,0),this._drawQuad(this.blurP,this.quadBuf),n.bindFramebuffer(n.FRAMEBUFFER,h.blurA.fbo),n.bindTexture(n.TEXTURE_2D,h.blurB.tex),n.uniform2f(this.blurU.u_dir,0,se/P),this._drawQuad(this.blurP,this.quadBuf)}}renderGlassPanel(e,r,t,i){if(this.contextLost)return;const a=this.gl,s=this.width,n=this.height,u=this.activeFBOs;a.enable(a.BLEND),a.blendFunc(a.SRC_ALPHA,a.ONE_MINUS_SRC_ALPHA),a.useProgram(this.glassP),a.activeTexture(a.TEXTURE0),a.bindTexture(a.TEXTURE_2D,u.bg.tex),a.uniform1i(this.glassU.u_bgTex,0),a.activeTexture(a.TEXTURE1),a.bindTexture(a.TEXTURE_2D,u.blurA.tex),a.uniform1i(this.glassU.u_blurTex,1),a.bindFramebuffer(a.FRAMEBUFFER,null),a.viewport(0,this.canvas.height-n,s,n),a.uniform2f(this.glassU.u_res,s,n),a.uniform2f(this.glassU.u_center,s*.5,n*.5),a.uniform2f(this.glassU.u_size,r*i,t*i),a.uniform1f(this.glassU.u_radius,e.cornerRadius*i),a.uniform1f(this.glassU.u_pad,Te*i),a.uniform1f(this.glassU.u_refract,e.refraction),a.uniform1f(this.glassU.u_chroma,e.chromAberration),a.uniform1f(this.glassU.u_edgeHL,e.edgeHighlight),a.uniform1f(this.glassU.u_spec,e.specular),a.uniform1f(this.glassU.u_fresnel,e.fresnel),a.uniform1f(this.glassU.u_distort,e.distortion),a.uniform1f(this.glassU.u_alpha,e.opacity),a.uniform1f(this.glassU.u_sat,e.saturation),a.uniform1f(this.glassU.u_tint,e.tintStrength),a.uniform3fv(this.glassU.u_tintColor,e.tintColor||[.92,.95,1.05]),a.uniform1f(this.glassU.u_zRadius,e.zRadius*i),a.uniform1f(this.glassU.u_brightness,e.brightness),a.uniform1f(this.glassU.u_shadowAlpha,e.shadowOpacity),a.uniform1f(this.glassU.u_shadowSpread,e.shadowSpread*i),a.uniform1f(this.glassU.u_shadowOffY,e.shadowOffsetY*i),a.uniform1f(this.glassU.u_bevelMode,e.bevelMode),this._drawQuad(this.glassP,this.panelBuf),a.disable(a.BLEND)}clear(){const e=this.gl;e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,this.canvas.height-this.height,this.width,this.height),e.enable(e.SCISSOR_TEST),e.scissor(0,this.canvas.height-this.height,this.width,this.height),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),e.disable(e.SCISSOR_TEST)}destroy(){if(this.canvas.removeEventListener("webglcontextlost",this._onContextLost),this.canvas.removeEventListener("webglcontextrestored",this._onContextRestored),!this.contextLost){const e=this.gl;for(const r of this.fboCache.values())this._freeFBOSet(r);this.fboCache.clear(),this.bgTex&&e.deleteTexture(this.bgTex),e.deleteBuffer(this.quadBuf),e.deleteBuffer(this.panelBuf),e.deleteProgram(this.blitP),e.deleteProgram(this.blurP),e.deleteProgram(this.glassP)}this.canvas.remove()}_setActiveSize(e,r){if(e<=0||r<=0)return!1;this.width=e,this.height=r,(this.canvas.width<e||this.canvas.height<r)&&(this.canvas.width=Math.max(this.canvas.width,e),this.canvas.height=Math.max(this.canvas.height,r));const t=`${e}x${r}`;let i=this.fboCache.get(t);if(!i)for(i={bg:this._makeFBO(e,r),blurA:this._makeFBO(e,r),blurB:this._makeFBO(e,r)},this.fboCache.set(t,i);this.fboCache.size>8;){const a=this.fboCache.keys().next().value;this._freeFBOSet(this.fboCache.get(a)),this.fboCache.delete(a)}return this.activeFBOs=i,!0}_makeFBO(e,r){const t=this.gl,i=t.createTexture();t.bindTexture(t.TEXTURE_2D,i),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,e,r,0,t.RGBA,t.UNSIGNED_BYTE,null),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE);const a=t.createFramebuffer();return t.bindFramebuffer(t.FRAMEBUFFER,a),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,i,0),t.bindFramebuffer(t.FRAMEBUFFER,null),{fbo:a,tex:i,w:e,h:r}}_freeFBO(e){if(!e)return;const r=this.gl;r.deleteFramebuffer(e.fbo),r.deleteTexture(e.tex)}_freeFBOSet(e){this._freeFBO(e.bg),this._freeFBO(e.blurA),this._freeFBO(e.blurB)}_compile(e,r){const t=this.gl,i=t.createShader(r);return t.shaderSource(i,e),t.compileShader(i),t.getShaderParameter(i,t.COMPILE_STATUS)?i:(console.error("LiquidGlass shader compile error:",t.getShaderInfoLog(i),e),null)}_link(e,r){const t=this.gl,i=t.createProgram();return t.attachShader(i,this._compile(e,t.VERTEX_SHADER)),t.attachShader(i,this._compile(r,t.FRAGMENT_SHADER)),t.linkProgram(i),t.getProgramParameter(i,t.LINK_STATUS)||console.error("LiquidGlass program link error:",t.getProgramInfoLog(i)),i}_uloc(e,r){const t=this.gl,i={};for(const a of r)i[a]=t.getUniformLocation(e,a);return i}_drawQuad(e,r){const t=this.gl,i=t.getAttribLocation(e,"a_pos");t.bindBuffer(t.ARRAY_BUFFER,r),t.enableVertexAttribArray(i),t.vertexAttribPointer(i,2,t.FLOAT,!1,0,0),t.drawArrays(t.TRIANGLE_STRIP,0,4)}};function ue(e,{query:r="",collection:t="research",year:i=1960,cluster:a=null}={}){const s=r.trim().toLocaleLowerCase();return e.filter(n=>n.scope!=="Excluded from confirmed publications"&&(!n.year||Number(n.year)>=i)&&(a===null||n.cluster===a)&&(t==="all"||t==="details"&&n.detailComplete||t==="projects"&&n.project_family||t==="research"&&n.work_class!=="Other team-member research; RASO relationship unassigned")&&(!s||[n.title,n.authors,n.team_members,n.project_family,n.methods,n.tools].join(" ").toLocaleLowerCase().includes(s)))}function he(e){try{const r=new URL(e);return["http:","https:"].includes(r.protocol)?r.href:null}catch{return null}}function p(e){return String(e??"").replace(/[&<>"']/g,r=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[r])}function Le(e){return Array.isArray(e)?e.join(" "):String(e||"")}function ge(e,r,t,i,a,s){return{x:Math.max(8,Math.min(a-Math.min(t,a-16)-8,e)),y:Math.max(70,Math.min(s-48,r)),w:Math.min(t,a-16),h:Math.min(i,s-86)}}function Ce(e,r,t=5){return(e.neighbors||[]).map(i=>({...i,node:r.get(i.id)})).filter(i=>i.node&&i.node.scope!=="Excluded from confirmed publications").slice(0,t)}function Ue(e,r,t=1){if(!e.length)return null;const i=e.findIndex(a=>a.id===r);return i<0?t<0?e.at(-1):e[0]:e[(i+(t<0?-1:1)+e.length)%e.length]}function Be(e,r){return Math.max(0,Math.min(e.x+e.w,r.x+r.w)-Math.max(e.x,r.x))*Math.max(0,Math.min(e.y+e.h,r.y+r.h)-Math.max(e.y,r.y))/Math.max(1,Math.min(e.w*e.h,r.w*r.h))}function De(e,r,t,i=16){const a=Math.min(e.w,r-16),s=Math.min(e.h,t-86);return{x:Math.max(8,Math.min(r-a-8,Math.round(e.x/i)*i)),y:Math.max(78,Math.min(t-s-8,Math.round(e.y/i)*i)),w:a,h:s}}const o=e=>document.getElementById(e),_=o("map"),m=_.getContext("2d"),K=o("graph-canvas"),d=K.getContext("2d"),W=["#9ac5ba","#d4a6a0","#a9b8e3","#e1c28c","#9ec7d8","#bcb3dd","#d1b6a6","#96c4ab","#b1c7de","#d3acbc","#bfd0a5","#c6be9e","#b0cdd0","#b8afd0"],Fe=["#447a69","#965858","#626daa","#907232","#46818f","#806ba0","#876250","#468260","#4e72a1","#9c5571","#738543","#897a46","#3e8285","#715f97"];let R,b=[],N,y=null,M=null,Q=[],A=85,L={x:0,y:0},j=!1,g=!1,X=!0,S=null;const x={query:"",collection:"research",year:1960,cluster:null};let c={kind:"solid",dark:"#1c1c1e",light:"#ffffff",image:"",art:0,autoSwap:!0},G=null,C=0,D=0;try{const e=JSON.parse(localStorage.getItem("raso:background")||"null");e&&(c={...c,...e})}catch{}function I(){try{localStorage.setItem("raso:background",JSON.stringify(c))}catch{}}function me(){if(!c.image){G=null;return}const e=new Image;e.onload=()=>{G=e,l()},e.src=c.image}const be=[{title:"Peaceable Kingdom",artist:"Edward Hicks",base:"d74e4c52-044a-48e7-a549-1f2d95d311b4",url:"https://www.nga.gov/artworks/59908-peaceable-kingdom"},{title:"The Westwood Children",artist:"Joshua Johnson",base:"3985dde4-8475-4df9-8ef8-5829de574a26",url:"https://www.nga.gov/artworks/45955-westwood-children"},{title:"The Hon. Mrs. Gray",artist:"Daniel Gardner",base:"4373e800-f8f6-45a6-848f-3d9e6150170f",url:"https://www.nga.gov/artworks/1212-hon-mrs-gray"}];let Z=null,V=0;function re(){const e=((Number(c.art)||0)%3+3)%3;c.art=e;const r=be[e];for(const a of document.querySelectorAll("[data-art]"))a.setAttribute("aria-pressed",String(Number(a.dataset.art)===e&&c.kind==="gallery"));o("art-credit").innerHTML=`<a href="${r.url}" target="_blank" rel="noopener noreferrer">${r.title} · ${r.artist} ↗</a>`;const t=++V,i=new Image;i.crossOrigin="anonymous",i.onload=()=>{t===V&&(Z=i,l())},i.onerror=()=>{t===V&&(o("background-error").textContent="Painting could not load. Choose another background.",o("background-error").hidden=!1)},i.src=`https://api.nga.gov/iiif/${r.base}/full/!1600,1000/0/default.jpg`}me();c.kind==="gallery"&&re();setInterval(()=>{document.hidden||c.kind!=="gallery"||!c.autoSwap||(c.art=(c.art+1)%3,I(),re())},3e5);try{g=localStorage.getItem("raso:light")==="true",X=localStorage.getItem("raso:glass")!=="false"}catch{}try{C=Math.max(0,Math.min(we.max,Number(localStorage.getItem("raso:blur"))||0)),o("links").checked=localStorage.getItem("raso:links")!=="false"}catch{}o("blur").value=C;o("blur-value").value=C;document.documentElement.toggleAttribute("data-light",g);const ee=matchMedia("(prefers-reduced-transparency: reduce)");let B;try{B=new Me}catch(e){console.warn("Optical rendering unavailable; clear surface fallback.",e)}const Ie=[...document.querySelectorAll(".glass")].map(e=>{const r=document.createElement("canvas");return r.className="optical-canvas",r.setAttribute("aria-hidden","true"),e.prepend(r),{surface:e,optical:r}}),E=document.createElement("canvas"),J=E.getContext("2d");function l(){j||(j=!0,requestAnimationFrame(()=>{j=!1,Oe()}))}function de(){const e=X&&!ee.matches;document.documentElement.toggleAttribute("data-low-transparency",!e),o("optics").checked=X,o("optics").disabled=ee.matches,o("theme").checked=!g,o("background-colour").value=g?c.light:c.dark;for(const{surface:r,optical:t}of Ie){if(!e||!B){r.removeAttribute("data-optical");continue}if(r.hidden||!r.getClientRects().length)continue;const i=r.getBoundingClientRect(),a=Math.min(1,950/Math.max(i.width,i.height)),s=20,n=_.width/innerWidth,u=_.height/innerHeight;if(i.width<1||i.height<1)continue;E.width=Math.ceil((i.width+s*2)*a),E.height=Math.ceil((i.height+s*2)*a),J.clearRect(0,0,E.width,E.height),J.filter=`blur(${C*a}px)`,J.drawImage(_,(i.left-s)*n,(i.top-s)*u,(i.width+s*2)*n,(i.height+s*2)*u,0,0,E.width,E.height);const v={...Re,cornerRadius:parseFloat(getComputedStyle(r).borderRadius)||20,...ye,blurAmount:C,brightness:D};B.uploadAndBlur(E,0,0,E.width,E.height,0),B.clear(),B.renderGlassPanel(v,i.width,i.height,a),t.width=Math.ceil(i.width*a),t.height=Math.ceil(i.height*a);const h=t.getContext("2d");h.clearRect(0,0,t.width,t.height),h.drawImage(B.canvas,s*a,s*a,t.width,t.height,0,0,t.width,t.height),r.dataset.optical="true"}}function ze(){if(m.fillStyle=g?c.light:c.dark,m.fillRect(0,0,innerWidth,innerHeight),c.kind==="image"&&G||c.kind==="gallery"&&Z){const e=c.kind==="gallery"?Z:G,r=Math.max(innerWidth/e.width,innerHeight/e.height),t=e.width*r,i=e.height*r;m.drawImage(e,(innerWidth-t)/2,(innerHeight-i)/2,t,i)}if(c.kind==="forms"||c.kind==="ink"){const e=innerWidth,r=innerHeight;if(m.save(),m.globalAlpha=c.kind==="ink"?.12:.17,c.kind==="forms")for(const[t,i,a,s,n,u]of[[.22,.42,.38,.19,-.6,g?"#ad6c51":"#ad8b74"],[.82,.65,.42,.23,.7,g?"#506d78":"#657f8a"],[.46,.88,.3,.28,.2,g?"#b3a681":"#9b9279"]])m.save(),m.translate(e*t,r*i),m.rotate(n),m.fillStyle=u,m.beginPath(),m.ellipse(0,0,e*a,r*s,0,0,Math.PI*2),m.fill(),m.restore();else{m.strokeStyle=g?"#282825":"#e5e0d7",m.lineWidth=Math.max(1,e*.003);for(let t=0;t<9;t++)m.beginPath(),m.moveTo(e*(.12+t*.007),r*.78),m.bezierCurveTo(e*.72,r*(.08+t*.014),e*.15,r*(.1+t*.009),e*(.84+t*.008),r*.65),m.stroke()}m.restore()}}function H(e){return{x:e.x*A+L.x,y:e.y*A+L.y}}function Oe(){const e=Math.min(devicePixelRatio||1,2);if((_.width!==Math.round(innerWidth*e)||_.height!==Math.round(innerHeight*e))&&(_.width=Math.round(innerWidth*e),_.height=Math.round(innerHeight*e)),m.setTransform(e,0,0,e,0,0),ze(),!R){de();return}const r=o("graph-pane").getBoundingClientRect();K.width=Math.round(r.width*e),K.height=Math.round(r.height*e),d.setTransform(e,0,0,e,-r.left*e,-r.top*e),d.save(),d.beginPath(),d.roundRect(r.left+1,r.top+39,r.width-2,Math.max(1,r.height-40),18),d.clip();const t=new Set(b.map(i=>i.id));if(o("links").checked)for(const i of R.edges){if(!t.has(i.source)||!t.has(i.target))continue;const a=H(N.get(i.source)),s=H(N.get(i.target)),n=y&&(i.source===y.id||i.target===y.id);d.beginPath(),d.moveTo(a.x,a.y),d.lineTo(s.x,s.y),d.strokeStyle=n?g?"rgba(23,66,80,.72)":"rgba(212,235,242,.65)":g?"rgba(48,93,115,.14)":"rgba(156,201,220,.07)",d.lineWidth=n?1.15:.5,i.type==="shared_project_family"&&d.setLineDash([3,4]),d.stroke(),d.setLineDash([])}Q=[];for(const i of b){const a=H(i);if(a.x<-15||a.y<-15||a.x>innerWidth+15||a.y>innerHeight+15)continue;const s=i.id===(y==null?void 0:y.id)||i.id===(M==null?void 0:M.id),n=s?6:i.detailComplete?3.6:2.3,u=(g?Fe:W)[i.cluster%W.length];d.beginPath(),d.fillStyle=u,d.globalAlpha=s?1:i.detailComplete?.98:.7,d.shadowColor=u,d.shadowBlur=s?19:i.detailComplete?7:0,d.arc(a.x,a.y,n,0,Math.PI*2),d.fill(),d.shadowBlur=0,d.globalAlpha=1,s&&(d.beginPath(),d.arc(a.x,a.y,12,0,Math.PI*2),d.strokeStyle=g?"rgba(30,74,89,.7)":"rgba(237,248,255,.72)",d.lineWidth=.8,d.stroke()),Q.push({node:i,...a,r:n})}if(b.length>6){d.textAlign="center",d.font=`12px ${getComputedStyle(document.documentElement).getPropertyValue("--glass-font-family")}`;const i=[];for(const a of R.clusters){const s=b.filter(u=>u.cluster===a.id);if(s.length<4)continue;const n=H({x:s.reduce((u,v)=>u+v.x,0)/s.length,y:s.reduce((u,v)=>u+v.y,0)/s.length});n.y-=24,!(n.x<320||n.x>innerWidth-55||n.y<90||n.y>innerHeight-80||i.some(u=>Math.hypot(n.x-u.x,n.y-u.y)<80))&&(d.fillStyle=g?"rgba(32,65,80,.68)":"rgba(191,211,224,.7)",d.fillText(a.label.replace(/ · /g," / "),n.x,n.y),i.push(n))}}b.length||(d.fillStyle=g?"#31586a":"#acc3cf",d.font=`14px ${getComputedStyle(document.documentElement).getPropertyValue("--glass-font-family")}`,d.textAlign="center",d.fillText("No papers match these filters",innerWidth*.63,innerHeight*.48)),d.restore(),de(),o("zoom-level").textContent=Math.round(A/85*100)+"%"}function U(){if(!b.length){l();return}const e=Math.min(...b.map(h=>h.x)),r=Math.max(...b.map(h=>h.x)),t=Math.min(...b.map(h=>h.y)),i=Math.max(...b.map(h=>h.y)),a=o("graph-pane").getBoundingClientRect(),s=a.left+25,n=a.right-25,u=a.top+65,v=a.bottom-25;A=Math.max(20,Math.min(200,(n-s)/Math.max(r-e,.7),(v-u)/Math.max(i-t,.7))*.84),L={x:(s+n)/2-(e+r)/2*A,y:(u+v)/2-(t+i)/2*A},l()}function z(){b=ue(R.nodes,x);const e=new Map;for(const r of ue(R.nodes,{...x,cluster:null}))e.set(r.cluster,(e.get(r.cluster)||0)+1);o("themes").innerHTML=R.clusters.filter(r=>e.has(r.id)).map(r=>`<button data-cluster="${r.id}" class="${x.cluster===r.id?"theme-active":""}" aria-pressed="${x.cluster===r.id}"><span class="theme-mark" style="color:${W[r.id%W.length]}" aria-hidden="true"></span><span class="theme-name">${p(r.label)}</span></button>`).join(""),o("papers").innerHTML=b.map(r=>`<button class="paper-result" data-paper="${r.id}"><span>${p(r.title)}</span><small>${p(r.year||"Year unavailable")} · ${p(r.team_members||r.authors).slice(0,90)}</small></button>`).join(""),o("previous-paper").disabled=b.length<2,o("next-paper").disabled=b.length<2,b.length||(o("papers").innerHTML='<p class="evidence-note">Try another search or an earlier year.</p>'),U()}function F(e,{focus:r=!1}={}){var v;o("hover").hidden=!0;const t=N.get(e);if(!t||t.scope==="Excluded from confirmed publications")return;y=t;const i=o("paper");i.hidden=!1,innerWidth<=600&&(document.querySelector(".library").hidden=!0,o("library-toggle").setAttribute("aria-expanded","false")),i.classList.remove("minimized");const a=t.detail||{},s=he(a.source_url||((v=a.sources)==null?void 0:v[0])||a.source||t.url),n=he(t.url),u=[["design","Study design"],["aim","Aim"],["objectives","Objectives"],["methods","Methods"],["statistics","Statistical analysis"],["tools","Tools"],["findings","Main findings"],["conclusions","Conclusions"],["limitations","Interpretation and limitations"]];o("paper-body").innerHTML=`<p class="paper-meta">${p(t.year||"UNDATED")} · ${p(t.journal||t.project_family||"RESEARCH RECORD")}</p><h2>${p(t.title)}</h2><p class="paper-authors">${p(t.authors||"Authors unavailable in the source record.")}</p><p class="paper-type">${p(t.publication_type.includes("awaiting publisher")?"Institutional publication record":t.publication_type)}${t.project_family?" · "+p(t.project_family):""}</p>${n?`<a class="source-link" href="${p(n)}" target="_blank" rel="noopener noreferrer">Read original source ↗</a>`:""}<p class="evidence-note">${/method excerpts|abstract\/introduction|source sections/i.test(a.coverage||"")?"Summary based on the article abstract and inspected sections; the full article has not been reviewed.":/abstract/i.test(a.coverage||"")?"Summary based on the published abstract. Full-text details may extend or qualify it.":a.coverage==="full text"?"Summary based on the full article. Source and interpretation are linked below.":/organisation archive/i.test(a.coverage||"")?"Summary based on the organisation’s survey article; linked report details may extend it.":t.detailComplete?"Paper-specific summary. Source and interpretation are linked below.":"Details available in this source record are presented below."}</p>`+u.map(([h,w])=>{const P=Le(a[h]);return`<section class="paper-section ${h==="findings"?"finding":""}"><h3>${w}</h3><p class="${P?"":"unextracted"}">${p(P||"See the original source for this detail.")}</p></section>`}).join("")+`<section class="paper-section"><h3>Textual neighbours</h3>${Ce(t,N).map(({node:h,similarity:w})=>`<button class="neighbor" data-paper="${h.id}">${p(h.title)}<small>${p(h.year)} · Textual similarity ${Math.round(w*100)}%</small></button>`).join("")}</section><p class="paper-source">${s?`Summary source: <a href="${p(s)}" target="_blank" rel="noopener noreferrer">${p(new URL(s).hostname)} ↗</a><br>`:""}${p(t.related_record||t.attribution)}</p>`,o("previous-paper").disabled=b.length<2,o("next-paper").disabled=b.length<2,o("paper-body").scrollTop=0,o("announcement").textContent="Selected "+t.title,history.replaceState(null,"","#"+t.id),r&&o("close").focus(),l()}function ve(e){const r=Ue(b,y==null?void 0:y.id,e);r&&F(r.id)}o("previous-paper").onclick=()=>ve(-1);o("next-paper").onclick=()=>ve(1);function ae(e){o("themes").hidden=e!=="themes",o("papers").hidden=e!=="papers";for(const r of["themes","papers"])o(r+"-tab").setAttribute("aria-pressed",String(r===e))}o("themes-tab").onclick=()=>ae("themes");o("papers-tab").onclick=()=>ae("papers");o("themes").onclick=e=>{const r=e.target.closest("[data-cluster]");if(!r)return;const t=Number(r.dataset.cluster);x.cluster=x.cluster===t?null:t,z()};for(const e of["papers","paper-body"])o(e).onclick=r=>{const t=r.target.closest("[data-paper]");t&&F(t.dataset.paper,{focus:e==="papers"})};o("search").oninput=e=>{x.query=e.target.value,x.cluster=null,ae("papers"),z()};o("collection").onchange=e=>{x.collection=e.target.value,x.cluster=null,z()};o("year").oninput=e=>{x.year=Number(e.target.value),o("year-value").textContent=x.year===1960?"All years":x.year,z()};function He(){x.query="",x.cluster=null,x.year=1960,x.collection="research",o("search").value="",o("year").value=1960,o("year-value").textContent="All years",o("collection").value="research",z()}o("reset").onclick=He;o("fit").onclick=U;o("links").onchange=l;function ie(e,r=innerWidth*.62,t=innerHeight*.5){const i=Math.max(15,Math.min(700,A*e));L={x:r-(r-L.x)*i/A,y:t-(t-L.y)*i/A},A=i,l()}o("zoom-in").onclick=()=>ie(1.25);o("zoom-out").onclick=()=>ie(.8);_.onwheel=e=>{e.preventDefault(),ie(Math.exp(-e.deltaY*.0013),e.clientX,e.clientY)};function xe(e,r){const t=o("graph-pane").getBoundingClientRect();if(e<t.left||e>t.right||r<t.top+38||r>t.bottom)return null;let i=null,a=14;for(const s of Q){const n=Math.hypot(e-s.x,r-s.y);n<a&&(i=s.node,a=n)}return i}_.onpointerdown=e=>{e.button===0&&(S={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,offset:{...L}},_.setPointerCapture(e.pointerId))};_.onpointermove=e=>{if(S){L={x:S.offset.x+e.clientX-S.x,y:S.offset.y+e.clientY-S.y},o("hover").hidden=!0,l();return}const r=xe(e.clientX,e.clientY);(r==null?void 0:r.id)!==(M==null?void 0:M.id)&&(M=r,l()),_.style.cursor=r?"pointer":"grab";const t=o("hover");if(t.hidden=!r,r){o("hover-body").innerHTML=`<div class="hover-content"><p class="hover-meta">${p(r.year||"Year unavailable")}${r.journal?" · "+p(r.journal):""}</p><h2>${p(r.title)}</h2><p class="hover-authors">${p(r.authors||r.team_members||"")}</p></div>`;const i=t.getBoundingClientRect(),a=e.clientX+18+i.width>innerWidth-12?e.clientX-i.width-18:e.clientX+18,s=e.clientY+16+i.height>innerHeight-12?e.clientY-i.height-16:e.clientY+16;t.style.left=Math.max(12,a)+"px",t.style.top=Math.max(72,s)+"px",l()}};_.onpointerup=e=>{if(S&&Math.hypot(e.clientX-S.startX,e.clientY-S.startY)<5){const r=xe(e.clientX,e.clientY);r&&F(r.id)}S=null};_.onpointercancel=()=>{S=null};_.onpointerleave=()=>{M=null,o("hover").hidden=!0,l()};const f=o("paper"),$=f.querySelector(".paper-handle");let k;$.onpointerdown=e=>{if(e.target.closest("button")||f.classList.contains("expanded"))return;const r=f.getBoundingClientRect();k={x:e.clientX,y:e.clientY,left:r.left,top:r.top},$.setPointerCapture(e.pointerId)};$.onpointermove=e=>{if(!k)return;const r=f.getBoundingClientRect(),t=ge(k.left+e.clientX-k.x,k.top+e.clientY-k.y,r.width,r.height,innerWidth,innerHeight);f.style.left=t.x+"px",f.style.top=t.y+"px",f.style.setProperty("--paper-left",t.x+"px"),f.style.setProperty("--paper-top",t.y+"px"),f.style.right="auto",l()};$.onpointerup=()=>{k&&_e(f),k=null};$.onpointercancel=()=>k=null;o("minimize").onclick=()=>{f.classList.remove("expanded"),f.classList.toggle("minimized"),o("minimize").setAttribute("aria-label",f.classList.contains("minimized")?"Restore paper":"Minimize paper"),l()};o("expand").onclick=()=>{f.classList.toggle("expanded"),f.classList.remove("minimized"),l()};o("close").onclick=()=>{f.hidden=!0,y=null,history.replaceState(null,"",location.pathname+location.search),_.focus(),l()};o("theme").onchange=e=>{g=!e.target.checked,document.documentElement.toggleAttribute("data-light",g);try{localStorage.setItem("raso:light",g)}catch{}l()};o("optics").onchange=e=>{X=e.target.checked;try{localStorage.setItem("raso:glass",X)}catch{}l()};ee.addEventListener("change",l);function ne(){o("settings-panel").hidden=!0,o("settings").setAttribute("aria-expanded","false"),l()}o("settings").onclick=()=>{const e=o("settings-panel");e.hidden=!e.hidden,o("settings").setAttribute("aria-expanded",String(!e.hidden)),l()};document.addEventListener("pointerdown",e=>{e.target.closest("#settings-panel,#settings")||ne()});o("about").onclick=()=>{ne(),o("about-dialog").showModal(),l()};function Y(){for(const e of document.querySelectorAll("[data-background]"))e.setAttribute("aria-pressed",String(e.dataset.background===c.kind));for(const e of document.querySelectorAll("[data-art]"))e.setAttribute("aria-pressed",String(c.kind==="gallery"&&Number(e.dataset.art)===c.art));o("colour-row").hidden=c.kind!=="solid",o("image-row").hidden=c.kind!=="image";for(const e of["swap-row","art-credit"])o(e).hidden=c.kind!=="gallery"}Y();document.querySelectorAll("[data-background]").forEach(e=>e.onclick=()=>{c.kind=e.dataset.background,Y(),I(),l()});o("background-colour").oninput=e=>{const r=e.target.value;/^#[0-9a-f]{6}$/i.test(r)&&(c[g?"light":"dark"]=r,I(),l())};o("background-file").onchange=async e=>{var a;const r=(a=e.target.files)==null?void 0:a[0];if(!r)return;const t=o("background-error");if(t.hidden=!0,!["image/png","image/jpeg","image/webp"].includes(r.type)||r.size>16*1024*1024){t.textContent="Choose a PNG, JPEG or WebP image up to 16 MB.",t.hidden=!1;return}const i=URL.createObjectURL(r);try{const s=new Image;s.src=i,await s.decode();const n=Math.min(1,1600/Math.max(s.width,s.height)),u=document.createElement("canvas");u.width=Math.max(1,Math.round(s.width*n)),u.height=Math.max(1,Math.round(s.height*n)),u.getContext("2d").drawImage(s,0,0,u.width,u.height),c.image=u.toDataURL("image/jpeg",.85),c.kind="image",I(),me(),Y(),l()}catch{t.textContent="This image could not be opened.",t.hidden=!1}finally{URL.revokeObjectURL(i)}};o("close-about").onclick=()=>o("about-dialog").close();addEventListener("keydown",e=>{(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"&&(e.preventDefault(),o("search").focus()),e.key==="Escape"&&(o("settings-panel").hidden?f.hidden||o("close").click():(ne(),o("settings").focus()))});new ResizeObserver(l).observe(f);addEventListener("resize",()=>{R?U():l()});async function Ne(){try{const e=await fetch("/raso-evidence-map/raso/evidence.json");if(!e.ok)throw Error("Research data returned "+e.status);R=await e.json(),N=new Map(R.nodes.map(t=>[t.id,t])),window.__raso={data:R,state:x,get visible(){return b},get selected(){return y},showPaper:F,fit:U,position:H},o("about-content").innerHTML="<h3>What the map shows</h3><p>Each point is a paper or report. Papers that discuss similar subjects tend to sit near one another. Colours mark groups with shared topics.</p><h3>How groups are formed</h3><p>The map compares words in titles and available abstracts. Titles carry extra weight because some records have more text than others. The computer groups similar records, then places them on a flat map. This view simplifies their relationships, so distance is a guide rather than a precise measure.</p><h3>What connections mean</h3><p>Solid lines join records with similar wording. Dashed lines join records from the same documented project. A line does not mean that one paper cites another, that their findings agree, or that one result causes another.</p><h3>Reading a paper</h3><p>Select a point or use the paper list. The paper window separates the study’s purpose, methods, findings and interpretation. Its source link opens the original publication. An abstract summary has less detail than a full-paper summary; the window identifies which was used.</p><h3>Arranging your view</h3><p>Drag the graph to pan and use the zoom controls to change scale. Drag a pane header to move the pane and its curved corner grip to resize it. Panes snap into place when released and rearrange when they overlap substantially. The gear menu controls glass, blur, brightness, fonts and backgrounds.</p>",z();const r=location.hash.slice(1);r&&F(r)}catch(e){o("papers").innerHTML=`<p class="evidence-note">${p(e.message)}</p>`,o("announcement").textContent=e.message,console.error(e)}}l();Ne();const T=document.querySelector(".library");o("library-toggle").onclick=()=>{T.hidden=!T.hidden,o("library-toggle").setAttribute("aria-expanded",String(!T.hidden)),!T.hidden&&innerWidth<=600&&(f.hidden=!0),l()};for(const e of document.querySelectorAll("[data-resize]")){const r=e.dataset.resize==="paper"?f:e.dataset.resize==="graph"?o("graph-pane"):T;let t;e.onpointerdown=i=>{i.preventDefault();const a=r.getBoundingClientRect();t={x:i.clientX,y:i.clientY,w:a.width,h:a.height,left:a.left,top:a.top},e.setPointerCapture(i.pointerId)},e.onpointermove=i=>{if(!t)return;const a=Math.max(innerWidth<=600?200:220,Math.min(innerWidth-t.left-8,t.w+i.clientX-t.x)),s=Math.max(180,Math.min(innerHeight-t.top-8,t.h+i.clientY-t.y));r.style.setProperty("width",a+"px","important"),r.style.setProperty("height",s+"px","important"),r.style.bottom="auto",l()},e.onpointerup=e.onpointercancel=()=>t=null,e.onkeydown=i=>{if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(i.key))return;i.preventDefault();const a=r.getBoundingClientRect();r.style.setProperty("width",Math.max(220,Math.min(innerWidth-a.left-8,a.width+(i.key==="ArrowRight"?20:i.key==="ArrowLeft"?-20:0)))+"px","important"),r.style.setProperty("height",Math.max(180,Math.min(innerHeight-a.top-8,a.height+(i.key==="ArrowDown"?20:i.key==="ArrowUp"?-20:0)))+"px","important"),r.style.bottom="auto",l()},new ResizeObserver(l).observe(r)}addEventListener("resize",()=>{for(const e of[f,T])e.style.removeProperty("width"),e.style.removeProperty("height"),e.style.removeProperty("bottom");innerWidth>600?T.hidden=!1:f.hidden||(T.hidden=!0),o("library-toggle").setAttribute("aria-expanded",String(!T.hidden))});o("blur").oninput=e=>{C=Number(e.target.value),o("blur-value").value=C;try{localStorage.setItem("raso:blur",C)}catch{}l()};o("links").addEventListener("change",e=>{try{localStorage.setItem("raso:links",e.target.checked)}catch{}l()});o("art-swap").checked=c.autoSwap;o("art-swap").onchange=e=>{c.autoSwap=e.target.checked,I()};document.querySelectorAll("[data-art]").forEach(e=>{e.style.backgroundImage=`url(https://api.nga.gov/iiif/${be[Number(e.dataset.art)].base}/full/!240,180/0/default.jpg)`,e.onclick=()=>{c.kind="gallery",c.art=Number(e.dataset.art),re(),Y(),I(),l()}});let q={};try{q=JSON.parse(localStorage.getItem("raso:text-colours")||"{}")}catch{}function oe(){const e=q[g?"light":"dark"]||(g?"#1d1d1f":"#f5f5f7");document.documentElement.style.setProperty("--ink",e),document.documentElement.style.setProperty("--muted",e),document.documentElement.style.color=e,o("text-colour").value=e,l()}o("text-colour").oninput=e=>{q[g?"light":"dark"]=e.target.value;try{localStorage.setItem("raso:text-colours",JSON.stringify(q))}catch{}oe()};o("theme").addEventListener("change",oe);oe();for(const e of[T,o("graph-pane")]){const r=e.querySelector(".pane-handle");let t;r.onpointerdown=i=>{const a=e.getBoundingClientRect();t={x:i.clientX,y:i.clientY,left:a.left,top:a.top,w:a.width,h:a.height},r.setPointerCapture(i.pointerId)},r.onpointermove=i=>{if(!t)return;const a=ge(t.left+i.clientX-t.x,t.top+i.clientY-t.y,t.w,t.h,innerWidth,innerHeight);e.style.setProperty("left",a.x+"px","important"),e.style.setProperty("top",Math.max(70,Math.min(innerHeight-t.h-8,a.y))+"px","important"),e.style.width=t.w+"px",e.style.height=t.h+"px",e.style.right="auto",e.style.bottom="auto",e.id==="graph-pane"?U():l()},r.onpointerup=()=>{t&&_e(e),t=null},r.onpointercancel=()=>t=null}new ResizeObserver(()=>{R&&U()}).observe(o("graph-pane"));const fe={system:"-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",arial:"Arial, sans-serif",helvetica:"'Helvetica Neue', Helvetica, sans-serif",georgia:"Georgia, serif"};function te(e){fe[e]||(e="system"),document.documentElement.style.setProperty("--glass-font-family",fe[e]);for(const r of document.querySelectorAll("[data-font]"))r.setAttribute("aria-pressed",String(r.dataset.font===e));try{localStorage.setItem("raso:font",e)}catch{}l()}for(const e of document.querySelectorAll("[data-font]"))e.onclick=()=>te(e.dataset.font);try{te(localStorage.getItem("raso:font")||"system")}catch{te("system")}function O(e){const r=e.getBoundingClientRect();return{x:r.left,y:r.top,w:r.width,h:r.height}}function pe(e,r){e.classList.remove("expanded"),e.style.minWidth="0";for(const[t,i]of Object.entries({left:r.x,top:r.y,width:r.w,height:r.h}))e.style.setProperty(t,i+"px","important");e.style.setProperty("--paper-left",r.x+"px"),e.style.setProperty("--paper-top",r.y+"px"),e.style.right="auto",e.style.bottom="auto"}function _e(e){const r=[T,o("graph-pane"),f].filter(t=>!t.hidden&&!t.classList.contains("minimized"));if(pe(e,De(O(e),innerWidth,innerHeight)),innerWidth>600&&r.some(t=>t!==e&&Be(O(e),O(t))>.3)){const t=r.sort((h,w)=>O(h).x-O(w).x),i=16,a=16,s=innerWidth-a*2-i*(t.length-1),n=t.map(h=>h.id==="graph-pane"?1.35:h===f?1.2:.8),u=n.reduce((h,w)=>h+w,0);let v=a;t.forEach((h,w)=>{const P=Math.floor(s*n[w]/u/16)*16;pe(h,{x:v,y:80,w:P,h:innerHeight-96}),v+=P+i})}U(),l()}try{D=Math.max(-.4,Math.min(.4,Number(localStorage.getItem("raso:brightness"))||0))}catch{}o("brightness").value=Math.round(D*100);o("brightness-value").value=Math.round(D*100);o("brightness").oninput=e=>{D=Number(e.target.value)/100,o("brightness-value").value=e.target.value;try{localStorage.setItem("raso:brightness",D)}catch{}l()};addEventListener("hashchange",()=>{const e=location.hash.slice(1);R&&e&&e!==(y==null?void 0:y.id)&&F(e)});
