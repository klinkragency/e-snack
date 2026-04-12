-- P0: Contrainte UNIQUE sur payment_intent_id (prévient les doublons Mollie)
ALTER TABLE orders ADD CONSTRAINT orders_payment_intent_id_unique UNIQUE (payment_intent_id);

-- P0: Ajouter le statut 'expired' (paiements abandonnés après timeout)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'expired'));

-- P0: Table outbox pour les webhooks Mollie (pattern: save first, process async)
-- Garantit qu'aucun webhook n'est perdu même si la DB est temporairement indisponible
CREATE TABLE payment_webhook_events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mollie_id    VARCHAR(255) NOT NULL,
    status       VARCHAR(20)  NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'processed', 'failed')),
    attempts     INT          NOT NULL DEFAULT 0,
    last_error   TEXT,
    received_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_payment_webhook_events_status
    ON payment_webhook_events(status, received_at)
    WHERE status = 'pending';

-- P1: Audit trail complet des événements de paiement
CREATE TABLE payment_events (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id   UUID         NOT NULL REFERENCES orders(id),
    mollie_id  VARCHAR(255),
    event_type VARCHAR(50)  NOT NULL,
    amount     DECIMAL(10, 2),
    metadata   JSONB,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_events_order_id ON payment_events(order_id);
