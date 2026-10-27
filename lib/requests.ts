import { PoolRequestSchemaInput } from './validation';
import { getPublicSupabase } from './supabase/public';
import { isDemoMode } from './data-mode';
import { PoolCategory, PoolRequest } from '@/types';
import { addDemoRequest } from './mock-data';

/**
 * Submits a demand discovery pool request via the public RPC or demo store.
 */
export async function executePoolRequest(
  input: PoolRequestSchemaInput
): Promise<{ id: string; isDemo: boolean }> {
  if (isDemoMode()) {
    const demoId = `demo-req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newRequest: PoolRequest = {
      id: demoId,
      productName: input.productName,
      category: (input.category as PoolCategory) || null,
      categoryName: input.categoryName || (!input.category ? null : null),
      brandPreference: input.brandPreference || null,
      modelPreference: input.modelPreference || null,
      city: input.city,
      state: input.state || null,
      locality: input.locality || null,
      pinCode: input.pinCode || null,
      requirementsSummary: input.requirementsSummary || null,
      targetBuyersRequested: input.targetBuyersRequested || 10,
      requestedDeadline: input.requestedDeadline || null,
      contactConsent: input.contactConsent ?? true,
      consentAt: new Date().toISOString(),
      requestType: input.requestType || 'GROUP_PROPOSAL',
      fullName: input.fullName || null,
      whatsappNumber: input.whatsappNumber || null,
      extraMessage: input.extraMessage || '',
      status: 'REQUESTED',
      adminNotes: '',
      resultingPoolId: null,
      conversionStatus: 'PENDING',
      createdAt: new Date().toISOString(),
      reviewedAt: null,
    };

    addDemoRequest(newRequest);
    return { id: demoId, isDemo: true };
  }

  const supabase = getPublicSupabase();
  if (!supabase) {
    throw new Error('Supabase client is not available');
  }

  const { data, error } = await supabase.rpc('submit_pool_request', {
    p_product_name: input.productName,
    p_city: input.city,
    p_category: input.category || null,
    p_full_name: input.fullName || null,
    p_whatsapp_number: input.whatsappNumber || null,
    p_extra_message: input.extraMessage || '',
    p_brand_preference: input.brandPreference || null,
    p_model_preference: input.modelPreference || null,
    p_category_name: input.categoryName || null,
  });

  if (error) {
    console.error('Error submitting pool request:', error.message);
    throw error;
  }

  return { id: data as string, isDemo: false };
}
