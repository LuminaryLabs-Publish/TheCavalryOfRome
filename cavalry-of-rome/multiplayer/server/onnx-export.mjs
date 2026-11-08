/** Portable dependency-free ONNX ModelProto (opset 13: MatMul + Add).
 * The small policy is trained online by JS SGD; this serializes current weights
 * as an ONNX inference snapshot for Node ORT or onnxruntime-web/WASM.
 */
const enc=new TextEncoder();
const pack=(...parts)=>{
 const arrays=parts.flat().map(x=>x instanceof Uint8Array?x:new Uint8Array(x));
 const output=new Uint8Array(arrays.reduce((n,x)=>n+x.length,0));let at=0;
 for(const a of arrays){output.set(a,at);at+=a.length;}return output;
};
const varint=n=>{const a=[];let x=BigInt(n);do{let b=Number(x&127n);x>>=7n;if(x)b|=128;a.push(b);}while(x);return Uint8Array.from(a);};
const tag=(n,wire)=>varint((n<<3)|wire);
const integer=(field,value)=>pack(tag(field,0),varint(value));
const bytes=(field,value)=>pack(tag(field,2),varint(value.length),value);
const str=(field,value)=>bytes(field,enc.encode(value));
const message=(field,...parts)=>bytes(field,pack(...parts));
const floats=values=>{const data=new Uint8Array(values.length*4),view=new DataView(data.buffer);
 values.forEach((x,i)=>view.setFloat32(i*4,x,true));return data;};
function tensor(name,dims,data){return pack(...dims.map(n=>integer(1,n)),integer(2,1),str(8,name),bytes(9,floats(data)));}
function valueInfo(name,dims){const shape=pack(...dims.map(n=>message(1,integer(1,n))));
 const tensorType=pack(integer(1,1),bytes(2,shape));return pack(str(1,name),message(2,message(1,tensorType)));}
function node(inputs,outputs,type){return pack(...inputs.map(x=>str(1,x)),...outputs.map(x=>str(2,x)),str(4,type));}
export function encodePolicyOnnx({weights,bias,inputs=12,outputs=8}){
 if(weights?.length!==inputs*outputs||bias?.length!==outputs)throw new Error('Invalid policy tensor dimensions');
 if(![...weights,...bias].every(Number.isFinite))throw new Error('Non-finite policy tensor');
 const graph=pack(message(1,node(['input','weights'],['matmul'],'MatMul')),
   message(1,node(['matmul','bias'],['logits'],'Add')),
   str(2,'CavalryOpponentPolicy'),
   message(5,tensor('weights',[inputs,outputs],weights)),message(5,tensor('bias',[outputs],bias)),
   message(11,valueInfo('input',[1,inputs])),message(12,valueInfo('logits',[1,outputs])));
 return pack(integer(1,8),str(2,'LuminaryLabs-CavalryOfRome'),str(3,'1.0'),message(7,graph),message(8,integer(2,13)));
}
