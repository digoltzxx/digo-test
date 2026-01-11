import { supabase } from "@/integrations/supabase/client";

/**
 * Service for managing student enrollments in courses
 * Automatically handles enrollment creation after payment approval
 * Supports both one-time purchases and subscriptions
 */

interface EnrollmentResult {
  success: boolean;
  enrollmentId?: string;
  error?: string;
}

interface SubscriptionAccessResult {
  hasAccess: boolean;
  status?: string;
  expiresAt?: string;
  reason?: string;
}

/**
 * Create enrollment after payment is approved
 * This is called from the webhook handler when a sale is approved
 */
export const createEnrollmentAfterPayment = async (
  saleId: string,
  studentEmail: string,
  studentName: string,
  productId: string
): Promise<EnrollmentResult> => {
  try {
    // Use the database function for atomic enrollment creation
    const { data, error } = await supabase.rpc("create_enrollment_after_payment", {
      p_sale_id: saleId,
      p_student_email: studentEmail,
      p_student_name: studentName,
      p_product_id: productId,
    });

    if (error) throw error;

    return {
      success: true,
      enrollmentId: data,
    };
  } catch (error: any) {
    console.error("Error creating enrollment:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Revoke enrollment when payment is cancelled/refunded/chargedback
 */
export const revokeEnrollmentOnPaymentIssue = async (
  saleId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.rpc("revoke_enrollment", {
      p_sale_id: saleId,
      p_reason: reason,
    });

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error("Error revoking enrollment:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if a product has a course linked (member area enabled)
 */
export const productHasCourse = async (productId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from("courses")
      .select("id")
      .eq("product_id", productId)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  } catch (error) {
    console.error("Error checking course:", error);
    return false;
  }
};

/**
 * Create course for product when member area delivery is selected
 */
export const ensureCourseExists = async (
  productId: string,
  productName: string,
  sellerId: string
): Promise<string | null> => {
  try {
    // Check if course already exists
    const { data: existingCourse } = await supabase
      .from("courses")
      .select("id")
      .eq("product_id", productId)
      .maybeSingle();

    if (existingCourse) {
      return existingCourse.id;
    }

    // Create new course
    const { data: newCourse, error } = await supabase
      .from("courses")
      .insert({
        product_id: productId,
        seller_user_id: sellerId,
        name: productName,
        status: "active",
      })
      .select("id")
      .single();

    if (error) throw error;

    // Create default module
    await supabase.from("course_modules").insert({
      course_id: newCourse.id,
      name: "Módulo 1",
      position: 0,
    });

    return newCourse.id;
  } catch (error) {
    console.error("Error ensuring course exists:", error);
    return null;
  }
};

/**
 * Get student enrollment status for a product
 */
export const getStudentEnrollmentStatus = async (
  studentEmail: string,
  productId: string
): Promise<{ enrolled: boolean; status?: string; expiresAt?: string }> => {
  try {
    // Get course for product
    const { data: course } = await supabase
      .from("courses")
      .select("id")
      .eq("product_id", productId)
      .maybeSingle();

    if (!course) {
      return { enrolled: false };
    }

    // Get student
    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("email", studentEmail)
      .eq("product_id", productId)
      .maybeSingle();

    if (!student) {
      return { enrolled: false };
    }

    // Get enrollment
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("status, expires_at")
      .eq("student_id", student.id)
      .eq("course_id", course.id)
      .maybeSingle();

    if (!enrollment) {
      return { enrolled: false };
    }

    return {
      enrolled: true,
      status: enrollment.status,
      expiresAt: enrollment.expires_at,
    };
  } catch (error) {
    console.error("Error checking enrollment status:", error);
    return { enrolled: false };
  }
};

/**
 * Check subscription-based access for a user
 * Returns whether the user has active subscription access to the product
 */
export const checkSubscriptionAccess = async (
  userId: string,
  productId: string
): Promise<SubscriptionAccessResult> => {
  try {
    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select("id, status, current_period_end, cancel_at_period_end")
      .eq("user_id", userId)
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!subscription) {
      return { hasAccess: false, reason: "Nenhuma assinatura encontrada" };
    }

    const now = new Date();
    const periodEnd = new Date(subscription.current_period_end);

    // Check if subscription is active
    if (subscription.status === "active" && periodEnd > now) {
      return {
        hasAccess: true,
        status: "active",
        expiresAt: subscription.current_period_end,
      };
    }

    // Canceled but still within period
    if (subscription.status === "canceled" && subscription.cancel_at_period_end && periodEnd > now) {
      return {
        hasAccess: true,
        status: "canceled_active",
        expiresAt: subscription.current_period_end,
        reason: "Assinatura cancelada - acesso até o vencimento",
      };
    }

    // Past due - suspended access
    if (subscription.status === "past_due") {
      return {
        hasAccess: false,
        status: "past_due",
        reason: "Pagamento pendente - acesso suspenso",
      };
    }

    // Expired
    return {
      hasAccess: false,
      status: subscription.status,
      reason: "Assinatura expirada ou cancelada",
    };
  } catch (error) {
    console.error("Error checking subscription access:", error);
    return { hasAccess: false, reason: "Erro ao verificar assinatura" };
  }
};

/**
 * Sync subscription enrollment access
 * Called when subscription status changes
 */
export const syncSubscriptionEnrollmentAccess = async (
  subscriptionId: string,
  action: "activate" | "suspend" | "revoke" | "expire"
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.rpc("sync_subscription_enrollment_access", {
      p_subscription_id: subscriptionId,
      p_action: action,
    });

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error("Error syncing subscription enrollment:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Get subscription access logs for audit
 */
export const getSubscriptionAccessLogs = async (
  subscriptionId: string
): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from("subscription_access_logs")
      .select("*")
      .eq("subscription_id", subscriptionId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching subscription logs:", error);
    return [];
  }
};

/**
 * Check if product is subscription-based
 */
export const isSubscriptionProduct = async (productId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("payment_type")
      .eq("id", productId)
      .single();

    if (error) throw error;
    return data?.payment_type === "subscription";
  } catch (error) {
    console.error("Error checking product type:", error);
    return false;
  }
};

/**
 * Get comprehensive member access status (combines enrollment + subscription)
 */
export const getMemberAccessStatus = async (
  userEmail: string,
  productId: string,
  userId?: string
): Promise<{
  hasAccess: boolean;
  accessType: "enrollment" | "subscription" | "none";
  status?: string;
  expiresAt?: string;
  reason?: string;
}> => {
  try {
    // First check enrollment status
    const enrollmentStatus = await getStudentEnrollmentStatus(userEmail, productId);
    
    if (enrollmentStatus.enrolled && enrollmentStatus.status === "active") {
      return {
        hasAccess: true,
        accessType: "enrollment",
        status: enrollmentStatus.status,
        expiresAt: enrollmentStatus.expiresAt,
      };
    }

    // If user ID provided, check subscription
    if (userId) {
      const subscriptionStatus = await checkSubscriptionAccess(userId, productId);
      
      if (subscriptionStatus.hasAccess) {
        return {
          hasAccess: true,
          accessType: "subscription",
          status: subscriptionStatus.status,
          expiresAt: subscriptionStatus.expiresAt,
          reason: subscriptionStatus.reason,
        };
      }

      // Return subscription status even if no access
      if (subscriptionStatus.status) {
        return {
          hasAccess: false,
          accessType: "subscription",
          status: subscriptionStatus.status,
          reason: subscriptionStatus.reason,
        };
      }
    }

    // Check if enrollment exists but not active
    if (enrollmentStatus.enrolled) {
      return {
        hasAccess: false,
        accessType: "enrollment",
        status: enrollmentStatus.status,
        reason: `Matrícula ${enrollmentStatus.status === "suspended" ? "suspensa" : "revogada"}`,
      };
    }

    return {
      hasAccess: false,
      accessType: "none",
      reason: "Nenhum acesso encontrado",
    };
  } catch (error) {
    console.error("Error checking member access:", error);
    return {
      hasAccess: false,
      accessType: "none",
      reason: "Erro ao verificar acesso",
    };
  }
};
