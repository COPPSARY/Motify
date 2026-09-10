import { EASE, editorialTextReveal, morph } from "../../../composition/presets";

/** One brief survives the whole journey. Paper -> review -> approved packet ->
 * delivered brief -> mark. An editorial concept for a fictional handoff tool. */
export function buildRelayTimeline({ root, timeline: t, register }) {
  const get = id => root.querySelector(`[data-edit="${id}"]`);
  root.querySelectorAll("[data-edit]").forEach(el => register(el.dataset.edit, el));
  const world = get("relayWorld"), paper = get("relayPaper");
  const notes = ["Copy", "Sound", "Final"].map(n => get("relayNote" + n));
  const faces = ["Draft", "Review", "Envelope", "Delivered", "Brand"].map(n => get("relay" + n + "Face"));
  const [draft, review, envelope, delivered, brand] = faces;
  const stamp = get("relayStamp"), tray = get("relayTray");
  const titles = ["Problem", "ReviewTitle", "ApproveTitle", "HandoffTitle"].map(n => get("relay" + n));
  const place = (el,x=0,y=0,extra={}) => t.set(el,{xPercent:-50,yPercent:-50,x,y,...extra},0);
  const show = (el,at,duration=.6) => t.to(el,{autoAlpha:1,duration,ease:EASE.arrive},at);
  const exit = (el,at,to={},duration=.65) => t.to(el,{...to,autoAlpha:0,duration,ease:EASE.depart},at);
  const words = (el,at) => editorialTextReveal(t,el,{at,duration:.48,stagger:.085,distance:24,blur:2});
  const shape = (to,at,duration=1) => morph(t,paper,to,{at,duration,ease:EASE.material});

  t.set(world,{x:0,y:0,scale:1,transformOrigin:"50% 50%"},0);
  t.set([...faces.slice(1),...titles.slice(1),...notes,paper,stamp,tray,get("relayRoute"),get("relayWordmark"),get("relayClose")],{autoAlpha:0},0);
  place(titles[0],0,-350);place(titles[1],0,-370,{fontSize:84});place(titles[2],0,-345,{fontSize:88});place(titles[3],1050,-315,{fontSize:80});
  place(paper,0,100,{rotationY:-8,rotationX:4,rotation:-2});
  place(notes[0],-625,-15,{rotation:-10});place(notes[1],610,65,{rotation:9});place(notes[2],440,360,{rotation:-5});
  place(stamp,285,160,{rotation:-16,scale:1.6});
  place(tray,1050,310,{rotationX:14});
  t.set(get("relayRoute"),{x:-50,y:-280,clipPath:"inset(0 100% 0 0)"},0);
  place(get("relayWordmark"),1050,-20);place(get("relayClose"),1050,160);
  for (const name of ["Copy","Sound","Final"]) {
    t.set(get("relay"+name+"Check"),{strokeDasharray:1,strokeDashoffset:1},0);
    t.set(get("relay"+name+"Status"),{autoAlpha:0,x:16},0);
  }

  // Wide establishing shot. No giant-to-settle opening or full app shell.
  words(titles[0],.18);
  t.fromTo(paper,{autoAlpha:0,y:180,rotationY:-16},{autoAlpha:1,y:100,rotationY:-8,duration:1,ease:EASE.arrive},.45);
  notes.forEach((note,i)=>t.fromTo(note,{autoAlpha:0,y:"+=45",rotationY:-12},{autoAlpha:1,y:i===0?-15:i===1?65:360,rotationY:0,duration:.75,ease:EASE.arrive},1.05+i*.22));
  t.to(paper,{rotationY:-4,rotation:-1,duration:2,ease:"sine.inOut"},1.8);

  // Scattered questions converge into the review rows on the same brief.
  exit(titles[0],3.8,{y:-520});
  notes.forEach((note,i)=>t.to(note,{x:200,y:-20+i*82,scale:.14,rotation:0,autoAlpha:0,duration:.95,ease:EASE.depart},4+i*.12));
  shape({width:1080,height:560,x:0,y:75,rotationY:-4,rotationX:2,rotation:0},4.1,1.1);
  exit(draft,4.35,{y:-28},.65);show(review,4.65,.65);words(titles[1],4.8);
  ["Copy","Sound","Final"].forEach((name,i)=>{
    t.to(get("relay"+name+"Check"),{strokeDashoffset:0,duration:.45,ease:EASE.arrive},6.2+i*1.05);
    t.to(get("relay"+name+"Status"),{x:0,autoAlpha:1,duration:.45,ease:EASE.arrive},6.35+i*1.05);
  });

  // A stamp is the punctuation. The paper holds its reading plane.
  exit(titles[1],9.25,{y:-500});words(titles[2],10);
  t.fromTo(stamp,{autoAlpha:0,scale:1.6,y:80},{autoAlpha:1,scale:1,y:160,duration:.45,ease:EASE.depart},9.45);
  t.to(paper,{rotationY:-8,rotationX:4,duration:1.2,ease:EASE.material},10.25);
  t.to(stamp,{rotation:-12,duration:2,ease:"sine.inOut"},10.2);

  // The approved brief folds into its packet. The material carries the edit.
  exit(titles[2],13.9,{x:-320},.7);
  exit(stamp,14.15,{scale:.28,x:0,y:0},.7);
  t.to(review,{clipPath:"inset(45% 0 45% 0)",autoAlpha:0,duration:.75,ease:EASE.material},14.15);
  shape({width:600,height:350,y:80,rotationY:-10,rotationX:8,backgroundColor:"#e46047",borderRadius:16},14.2,1.1);
  show(envelope,14.65,.65);
  show(get("relayRoute"),15.25,.45);show(tray,15.6,.6);
  t.to(get("relayRoute"),{clipPath:"inset(0 0% 0 0)",duration:2.6,ease:EASE.cameraRamp},15.4);
  t.to(paper,{x:610,y:-120,rotation:-7,rotationY:-16,duration:1.45,ease:EASE.travel},15.5);
  t.to(paper,{x:1050,y:55,rotation:0,rotationY:-5,rotationX:3,duration:1.2,ease:EASE.settle},16.95);
  t.to(world,{x:-1050,duration:2.65,ease:EASE.cameraRamp},15.65);
  words(titles[3],18.15);
  exit(get("relayRoute"),18.45,{},.55);
  shape({width:840,height:420,y:60,rotationY:0,rotationX:0,backgroundColor:"#fffdf8"},18.8,1.1);
  exit(envelope,18.9,{y:85},.65);show(delivered,19.25,.65);

  // The delivered brief becomes the mark on the same world coordinate.
  exit(titles[3],20.75,{y:-460},.65);exit(tray,20.9,{y:480},.75);
  exit(delivered,21.15,{y:50},.6);
  shape({x:1050,y:-225,width:144,height:144,borderRadius:32,backgroundColor:"#e46047",rotationY:0,rotationX:0},21.15,1.15);
  show(brand,21.65,.65);
  show(get("relayWordmark"),22.1,.6);words(get("relayClose"),22.65);
  t.to(paper,{rotationY:8,y:-234,duration:2.4,ease:"sine.inOut"},23.6);
}
