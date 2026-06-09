import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServer = createClient(supabaseUrl, supabaseAnonKey);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://ecomlaos.com';

  // Static routes
  const routes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/register`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  try {
    // Dynamic product routes
    const { data: products } = await supabaseServer
      .from('products')
      .select('id, created_at');

    if (products) {
      products.forEach((product) => {
        routes.push({
          url: `${baseUrl}/product/${product.id}`,
          lastModified: product.created_at ? new Date(product.created_at) : new Date(),
          changeFrequency: 'weekly',
          priority: 0.8,
        });
      });
    }

    // Dynamic shop routes
    const { data: shops } = await supabaseServer
      .from('shops')
      .select('slug, created_at')
      .eq('is_active', true);

    if (shops) {
      shops.forEach((shop) => {
        if (shop.slug) {
          routes.push({
            url: `${baseUrl}/shop/${shop.slug}`,
            lastModified: shop.created_at ? new Date(shop.created_at) : new Date(),
            changeFrequency: 'weekly',
            priority: 0.7,
          });
        }
      });
    }
  } catch (error) {
    console.error('Error generating sitemap dynamically:', error);
  }

  return routes;
}
