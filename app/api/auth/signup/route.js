import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { email, password, fullName, shopName, businessType } = await request.json();

    // 1. Create Tenant Record
    const { data: shop, error: shopError } = await supabaseAdmin
      .from('shops')
      .insert([{ name: shopName, business_type: businessType || 'general' }])
      .select()
      .single();

    if (shopError) throw shopError;

    // 2. Provision Supabase Auth User
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) throw authError;

    // 3. Associate user with shop_id
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert([{
        id: authUser.user.id,
        shop_id: shop.id,
        full_name: fullName,
        role: 'owner'
      }]);

    if (userError) throw userError;

    return NextResponse.json({ success: true, shopId: shop.id });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}