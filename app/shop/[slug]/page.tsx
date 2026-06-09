import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import ShopClient from './ShopClient';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServer = createClient(supabaseUrl, supabaseAnonKey);

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const resolvedParams = await params;
    const { slug } = resolvedParams;

    const { data: shop } = await supabaseServer
      .from('shops')
      .select('name_la, description_la, logo_url')
      .eq('slug', slug)
      .single();

    if (!shop) {
      return {
        title: 'ບໍ່ພົບຮ້ານຄ້າ | EcomLao',
      };
    }

    const title = `${shop.name_la} | ຮ້ານຄ້າອອນລາຍ ລາວ`;
    const description = shop.description_la || 'ລາຍລະອຽດຮ້ານຄ້າ';
    const logoUrl = shop.logo_url;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        images: logoUrl ? [logoUrl] : [],
      },
    };
  } catch (error) {
    return {
      title: 'ຮ້ານຄ້າ | EcomLao',
    };
  }
}

export default async function ShopPage() {
  return <ShopClient />;
}