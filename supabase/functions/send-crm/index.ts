import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CRMRequest {
  user_id: string;
  provider: 'hubspot' | 'pipedrive' | 'salesforce';
  action: 'create_deal' | 'update_deal' | 'create_contact';
  sale_id?: string;
  product_id?: string;
  contact_email: string;
  contact_name?: string;
  contact_phone?: string;
  deal_name?: string;
  deal_value?: number;
  stage?: string;
  metadata?: Record<string, unknown>;
}

// HubSpot API
async function createHubSpotDeal(
  accessToken: string,
  contactEmail: string,
  contactName: string | undefined,
  dealName: string,
  dealValue: number,
  pipelineId?: string
): Promise<{ success: boolean; dealId?: string; contactId?: string; error?: string }> {
  // 1. Create or update contact
  const contactResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        email: contactEmail,
        firstname: contactName?.split(' ')[0] || '',
        lastname: contactName?.split(' ').slice(1).join(' ') || '',
      },
    }),
  });

  let contactId: string | undefined;
  
  if (contactResponse.ok) {
    const contactData = await contactResponse.json();
    contactId = contactData.id;
  } else if (contactResponse.status === 409) {
    // Contact exists, search for it
    const searchResponse = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts/search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filterGroups: [{
            filters: [{
              propertyName: 'email',
              operator: 'EQ',
              value: contactEmail,
            }],
          }],
        }),
      }
    );
    const searchData = await searchResponse.json();
    contactId = searchData.results?.[0]?.id;
  }

  // 2. Create deal
  const dealPayload: Record<string, unknown> = {
    properties: {
      dealname: dealName,
      amount: dealValue,
      dealstage: 'closedwon',
    },
  };

  if (pipelineId) {
    dealPayload.properties = {
      ...(dealPayload.properties as Record<string, unknown>),
      pipeline: pipelineId,
    };
  }

  const dealResponse = await fetch('https://api.hubapi.com/crm/v3/objects/deals', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dealPayload),
  });

  if (!dealResponse.ok) {
    const error = await dealResponse.json();
    return { success: false, error: error.message || 'Failed to create deal' };
  }

  const dealData = await dealResponse.json();
  const dealId = dealData.id;

  // 3. Associate contact with deal
  if (contactId && dealId) {
    await fetch(
      `https://api.hubapi.com/crm/v3/objects/deals/${dealId}/associations/contacts/${contactId}/deal_to_contact`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );
  }

  return { success: true, dealId, contactId };
}

// Pipedrive API
async function createPipedriveDeal(
  apiToken: string,
  contactEmail: string,
  contactName: string | undefined,
  dealName: string,
  dealValue: number,
  pipelineId?: string
): Promise<{ success: boolean; dealId?: string; personId?: string; error?: string }> {
  const baseUrl = 'https://api.pipedrive.com/v1';
  
  // 1. Create person (contact)
  const personResponse = await fetch(`${baseUrl}/persons?api_token=${apiToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: contactName || contactEmail,
      email: [contactEmail],
    }),
  });

  const personData = await personResponse.json();
  const personId = personData.data?.id;

  // 2. Create deal
  const dealPayload: Record<string, unknown> = {
    title: dealName,
    value: dealValue,
    currency: 'BRL',
    status: 'won',
  };

  if (personId) dealPayload.person_id = personId;
  if (pipelineId) dealPayload.pipeline_id = parseInt(pipelineId);

  const dealResponse = await fetch(`${baseUrl}/deals?api_token=${apiToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dealPayload),
  });

  const dealData = await dealResponse.json();
  
  if (dealData.success) {
    return { success: true, dealId: dealData.data?.id?.toString(), personId: personId?.toString() };
  }

  return { success: false, error: dealData.error || 'Failed to create deal' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const request: CRMRequest = await req.json();
    
    console.log('CRM request:', request.provider, request.action);

    // Get user's integration config
    const { data: integration, error: intError } = await supabase
      .from('user_integrations')
      .select('config')
      .eq('user_id', request.user_id)
      .eq('integration_id', request.provider)
      .eq('connected', true)
      .single();

    if (intError || !integration) {
      throw new Error(`${request.provider} integration not configured`);
    }

    const config = integration.config as Record<string, string>;
    let result: { success: boolean; dealId?: string; contactId?: string; personId?: string; error?: string };

    const dealName = request.deal_name || `Venda - ${request.contact_email}`;
    const dealValue = request.deal_value || 0;

    switch (request.provider) {
      case 'hubspot': {
        if (!config.access_token) throw new Error('HubSpot access token not configured');
        result = await createHubSpotDeal(
          config.access_token,
          request.contact_email,
          request.contact_name,
          dealName,
          dealValue,
          config.pipeline_id
        );
        break;
      }
      
      case 'pipedrive': {
        if (!config.api_token) throw new Error('Pipedrive API token not configured');
        result = await createPipedriveDeal(
          config.api_token,
          request.contact_email,
          request.contact_name,
          dealName,
          dealValue,
          config.pipeline_id
        );
        break;
      }
      
      default:
        throw new Error(`Unsupported CRM provider: ${request.provider}`);
    }

    // Log to database
    await supabase.from('crm_deals').insert({
      user_id: request.user_id,
      provider: request.provider,
      sale_id: request.sale_id,
      product_id: request.product_id,
      provider_deal_id: result.dealId,
      contact_email: request.contact_email,
      contact_name: request.contact_name,
      deal_name: dealName,
      deal_value: dealValue,
      stage: 'won',
      pipeline_id: config.pipeline_id,
      synced_at: result.success ? new Date().toISOString() : null,
      sync_error: result.error,
      metadata: request.metadata,
    });

    console.log('CRM result:', result);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in CRM integration:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
