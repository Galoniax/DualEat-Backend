import { Router } from 'express';
import { 
    handleLocalSubscriptionCheckout, 
    handlePaymentNotification, 
    handleGetLocalSubscription, 
    handleToggleAutoRenew,
} from './payments.controller'; 
import { verifyPayment } from './payments.controller';

const subscriptionRouter = Router();

subscriptionRouter.post('/local-checkout', handleLocalSubscriptionCheckout); 
subscriptionRouter.get('/local/:localId', handleGetLocalSubscription);
subscriptionRouter.put('/local/toggle-renew', handleToggleAutoRenew);

// Webhooks de Mercado Pago
subscriptionRouter.post('/payments/mercadopago/notification', handlePaymentNotification);
subscriptionRouter.get('/payments/mercadopago/verify', verifyPayment);

export default subscriptionRouter;