// Stripe → workout_subscriptions. Payment Links open with ?client_reference_id=<Supabase user id>,
// so a finished checkout says whose subscription it is; later renewals and cancellations find the
// person by their Stripe customer id.
//
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (supabase secrets set …). Deploy with
// `supabase functions deploy stripe-webhook --no-verify-jwt` and point a Stripe webhook at it for
// checkout.session.completed, customer.subscription.updated and customer.subscription.deleted.
import Stripe from 'npm:stripe@17'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

function row(sub: Stripe.Subscription) {
  const item = sub.items.data[0] as Stripe.SubscriptionItem & { current_period_end?: number }
  // Newer API versions moved the period end from the subscription to its items.
  const end = item?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end
  return {
    plan: item?.price.recurring?.interval === 'year' ? 'yearly' : 'monthly',
    status: sub.status,
    current_period_end: end ? new Date(end * 1000).toISOString() : null,
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id
  }
}

Deno.serve(async (req) => {
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      await req.text(),
      req.headers.get('stripe-signature') ?? '',
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    )
  } catch {
    return new Response('Bad signature', { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    if (session.mode === 'subscription' && session.client_reference_id && session.subscription) {
      const sub = await stripe.subscriptions.retrieve(session.subscription as string)
      const { error } = await db.from('workout_subscriptions').upsert({ user_id: session.client_reference_id, ...row(sub) })
      if (error) return new Response(error.message, { status: 500 })
    }
  } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const r = row(event.data.object)
    const { error } = await db.from('workout_subscriptions').update(r).eq('stripe_customer_id', r.stripe_customer_id)
    if (error) return new Response(error.message, { status: 500 })
  }
  return new Response('ok')
})
