import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { createClient } from '@supabase/supabase-js';

// Force Next.js to never cache this route
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function crc16(data: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

export async function POST(req: NextRequest) {
  try {
    const { orderId, amount } = await req.json();
    if (!orderId || !amount) {
      return NextResponse.json({ error: 'Missing orderId or amount' }, { status: 400 });
    }

    // --- 1. BUILD STRICT EMVCo PAYLOAD ---
    let payload = '000201'; // Tag 00: Payload Format
    payload += '010212';    // Tag 01: Dynamic QR Code (CRITICAL)
    
    // Tag 38: BCEL Merchant Account Information
    payload += '38670016A00526628466257701082771041802030010324QDZNRPLTFVYIIIOJNUCUZYGC'; 
    
    // Tag 53: Currency (LAK = 418)
    payload += '5303418'; 

    // Tag 54: Transaction Amount
    const amountStr = Math.round(amount).toString();
    const amountLen = amountStr.length.toString().padStart(2, '0');
    payload += `54${amountLen}${amountStr}`;

    // Tag 58: Country Code
    payload += '5802LA';

    // Tag 59: Merchant Name (CRITICAL FOR STRICT PARSING)
    const merchantName = 'SOMPHONE DANGCHALEUN'; // <-- Update this to your actual store name
    const nameLen = merchantName.length.toString().padStart(2, '0');
    payload += `59${nameLen}${merchantName}`;

    // Tag 60: Merchant City (CRITICAL FOR STRICT PARSING)
    const merchantCity = 'VIENTIANE'; // <-- Update if operating out of another city
    const cityLen = merchantCity.length.toString().padStart(2, '0');
    payload += `60${cityLen}${merchantCity}`;

    // Tag 62: Additional Data (Highly recommended for mPOS)
    // Injecting a short version of the order ID makes banking reconciliation much easier
    const shortOrderId = orderId.toString().substring(0, 15);
    const subTag01Value = `01${shortOrderId.length.toString().padStart(2, '0')}${shortOrderId}`;
    const tag62Len = subTag01Value.length.toString().padStart(2, '0');
    payload += `62${tag62Len}${subTag01Value}`;

    // Tag 63: CRC Wrapper
    payload += '6304';
    
    // Calculate final CRC checksum over the entirely assembled string
    const crc = crc16(payload);
    const finalPayload = payload + crc;

    console.log('QR final payload:', finalPayload);

    // --- 2. SUPABASE VERIFICATION INSERT ---
    const { data: pvData, error: pvError } = await supabase
      .from('payment_verifications')
      .insert({
        order_id: orderId,
        amount,
        qr_payload: finalPayload,
        status: 'pending',
      })
      .select()
      .single();

    if (pvError) {
      console.error('Failed to insert payment_verifications:', pvError);
    } else {
      console.log('Payment verification record created for order ID:', pvData.id);
    }

    // --- 3. GENERATE IMAGE ---
    const qrBuffer = await QRCode.toBuffer(finalPayload, { errorCorrectionLevel: 'M' });
    const imageData = new Uint8Array(qrBuffer);
    return new NextResponse(imageData, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' },
    });
    
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}