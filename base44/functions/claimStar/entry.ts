import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { star_id, star_name, buyer_name, buyer_email, tier, custom_myth, amount_cents } = body;

    if (!star_id || !buyer_name || !tier) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if star already claimed (conflict resolution)
    const existing = await base44.asServiceRole.entities.Star.filter({ is_named: true });
    const alreadyClaimed = existing.find(s =>
      s.hip_id === star_id ||
      s.name?.toLowerCase() === star_name?.toLowerCase()
    );

    if (alreadyClaimed) {
      return Response.json({
        success: false,
        error: `"${star_name}" has already been claimed by ${alreadyClaimed.owner_name}. Please choose another star.`
      });
    }

    // Check if there's an existing Star record to update
    const allStars = await base44.asServiceRole.entities.Star.filter({});
    const existingStar = allStars.find(s =>
      s.hip_id === star_id ||
      s.name?.toLowerCase() === star_name?.toLowerCase()
    );

    const ownershipData = {
      is_named: true,
      owner_name: buyer_name,
      owner_user_id: user.id,
      ownership_tier: tier,
      ownership_date: new Date().toISOString(),
      custom_myth: tier === 'premium' ? (custom_myth || '') : '',
    };

    let claimedStar;
    if (existingStar) {
      claimedStar = await base44.asServiceRole.entities.Star.update(existingStar.id, ownershipData);
    } else {
      // Create new star record (with required fields defaulted)
      claimedStar = await base44.asServiceRole.entities.Star.create({
        hip_id: star_id,
        name: star_name,
        ra: 0,
        dec: 0,
        magnitude: 5,
        ...ownershipData,
      });
    }

    // Record the purchase
    await base44.asServiceRole.entities.StarPurchase.create({
      star_id: claimedStar.id,
      star_name,
      buyer_name,
      buyer_email: buyer_email || user.email,
      tier,
      amount_cents: amount_cents || (tier === 'premium' ? 2000 : 1000),
      status: 'completed',
      custom_myth: tier === 'premium' ? (custom_myth || '') : '',
    });

    return Response.json({
      success: true,
      star: claimedStar,
      message: `${star_name} has been claimed by ${buyer_name}!`,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});