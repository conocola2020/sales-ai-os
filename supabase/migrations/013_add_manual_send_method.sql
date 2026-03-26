-- Add 'manual' to send_method CHECK constraint
ALTER TABLE send_queue DROP CONSTRAINT IF EXISTS send_queue_send_method_check;
ALTER TABLE send_queue ADD CONSTRAINT send_queue_send_method_check
  CHECK (send_method IN ('email', 'form', 'manual'));
