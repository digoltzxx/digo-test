import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailMarketingRequest {
  user_id: string;
  provider: 'brevo' | 'mailchimp' | 'activecampaign';
  email: string;
  name?: string;
  phone?: string;
  list_id?: string;
  tags?: string[];
  custom_fields?: Record<string, unknown>;
  trigger_automation?: boolean;
  automation_id?: string;
}

// Brevo (Sendinblue) API
async function addToBrevo(
  apiKey: string,
  email: string,
  name?: string,
  listId?: number,
  attributes?: Record<string, unknown>
): Promise<{ success: boolean; contactId?: string; error?: string }> {
  const url = 'https://api.brevo.com/v3/contacts';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      attributes: { FIRSTNAME: name, ...attributes },
      listIds: listId ? [listId] : [],
      updateEnabled: true,
    }),
  });

  const data = await response.json();
  
  if (response.ok || response.status === 201) {
    return { success: true, contactId: data.id?.toString() };
  }
  
  // Handle duplicate contact
  if (response.status === 400 && data.code === 'duplicate_parameter') {
    return { success: true, contactId: 'duplicate' };
  }
  
  return { success: false, error: data.message || 'Unknown error' };
}

// Mailchimp API
async function addToMailchimp(
  apiKey: string,
  listId: string,
  email: string,
  name?: string,
  tags?: string[]
): Promise<{ success: boolean; contactId?: string; error?: string }> {
  const dc = apiKey.split('-')[1]; // Extract data center from API key
  const url = `https://${dc}.api.mailchimp.com/3.0/lists/${listId}/members`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email_address: email,
      status: 'subscribed',
      merge_fields: name ? { FNAME: name.split(' ')[0], LNAME: name.split(' ').slice(1).join(' ') } : {},
      tags: tags || [],
    }),
  });

  const data = await response.json();
  
  if (response.ok) {
    return { success: true, contactId: data.id };
  }
  
  // Handle existing subscriber
  if (response.status === 400 && data.title === 'Member Exists') {
    return { success: true, contactId: 'exists' };
  }
  
  return { success: false, error: data.detail || data.title || 'Unknown error' };
}

// ActiveCampaign API
async function addToActiveCampaign(
  apiUrl: string,
  apiKey: string,
  email: string,
  name?: string,
  listId?: string,
  tags?: string[]
): Promise<{ success: boolean; contactId?: string; error?: string }> {
  // Create or update contact
  const contactResponse = await fetch(`${apiUrl}/api/3/contact/sync`, {
    method: 'POST',
    headers: {
      'Api-Token': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contact: {
        email,
        firstName: name?.split(' ')[0],
        lastName: name?.split(' ').slice(1).join(' '),
      },
    }),
  });

  const contactData = await contactResponse.json();
  
  if (!contactResponse.ok) {
    return { success: false, error: contactData.message || 'Failed to create contact' };
  }

  const contactId = contactData.contact?.id;

  // Add to list if provided
  if (listId && contactId) {
    await fetch(`${apiUrl}/api/3/contactLists`, {
      method: 'POST',
      headers: {
        'Api-Token': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contactList: {
          list: listId,
          contact: contactId,
          status: 1,
        },
      }),
    });
  }

  // Add tags if provided
  if (tags && tags.length > 0 && contactId) {
    for (const tag of tags) {
      await fetch(`${apiUrl}/api/3/contactTags`, {
        method: 'POST',
        headers: {
          'Api-Token': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contactTag: {
            contact: contactId,
            tag,
          },
        }),
      });
    }
  }

  return { success: true, contactId };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const request: EmailMarketingRequest = await req.json();
    
    console.log('Adding contact to', request.provider, ':', request.email);

    // Get user's integration config
    const { data: integration, error: intError } = await supabase
      .from('user_integrations')
      .select('config')
      .eq('user_id', request.user_id)
      .eq('integration_id', 'email')
      .eq('connected', true)
      .single();

    if (intError || !integration) {
      throw new Error('Email marketing integration not configured');
    }

    const config = integration.config as Record<string, string>;
    let result: { success: boolean; contactId?: string; error?: string };

    switch (request.provider) {
      case 'brevo': {
        const apiKey = config.api_key || Deno.env.get('BREVO_API_KEY');
        if (!apiKey) throw new Error('Brevo API key not configured');
        
        result = await addToBrevo(
          apiKey,
          request.email,
          request.name,
          request.list_id ? parseInt(request.list_id) : undefined,
          request.custom_fields
        );
        break;
      }
      
      case 'mailchimp': {
        if (!config.api_key || !config.list_id) {
          throw new Error('Mailchimp API key and list ID required');
        }
        result = await addToMailchimp(
          config.api_key,
          request.list_id || config.list_id,
          request.email,
          request.name,
          request.tags
        );
        break;
      }
      
      case 'activecampaign': {
        if (!config.api_url || !config.api_key) {
          throw new Error('ActiveCampaign API URL and key required');
        }
        result = await addToActiveCampaign(
          config.api_url,
          config.api_key,
          request.email,
          request.name,
          request.list_id || config.list_id,
          request.tags
        );
        break;
      }
      
      default:
        throw new Error(`Unsupported provider: ${request.provider}`);
    }

    // Log to database
    await supabase.from('email_marketing_contacts').upsert({
      user_id: request.user_id,
      provider: request.provider,
      email: request.email,
      name: request.name,
      phone: request.phone,
      tags: request.tags || [],
      custom_fields: request.custom_fields || {},
      list_id: request.list_id,
      provider_contact_id: result.contactId,
      status: 'active',
      synced_at: result.success ? new Date().toISOString() : null,
      sync_error: result.error,
    }, {
      onConflict: 'user_id,provider,email',
    });

    console.log('Email marketing result:', result);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in email marketing:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
