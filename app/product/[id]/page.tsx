import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import ProductDetailClient from './ProductDetailClient';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServer = createClient(supabaseUrl, supabaseAnonKey);

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const { data: product } = await supabaseServer
      .from('products')
      .select('name_la, description_la, images')
      .eq('id', id)
      .single();

    if (!product) {
      return {
        title: 'ບໍ່ພົບສິນຄ້າ | EcomLao',
      };
    }

    const title = `${product.name_la} | ຮ້ານຄ້າອອນລາຍ ລາວ`;
    const description = product.description_la || 'ລາຍລະອຽດສິນຄ້າ';
    const images = product.images || [];

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'article',
        images: images.slice(0, 1),
      },
    };
  } catch (error) {
    return {
      title: 'ລາຍລະອຽດສິນຄ້າ | EcomLao',
    };
  }
}

export default async function ProductDetailPage() {
  return <ProductDetailClient />;
}