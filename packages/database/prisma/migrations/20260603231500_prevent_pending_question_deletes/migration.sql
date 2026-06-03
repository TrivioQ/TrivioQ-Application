-- Create a function that throws an exception when deleting or truncating, unless bypassed
CREATE OR REPLACE FUNCTION prevent_pending_question_delete()
RETURNS TRIGGER AS $$
DECLARE
  bypass_val TEXT;
BEGIN
  -- 1. Check if the current session has set the bypass variable
  BEGIN
    bypass_val := current_setting('myapp.bypass_pending_question_trigger', true);
  EXCEPTION WHEN OTHERS THEN
    bypass_val := NULL;
  END;

  IF bypass_val = 'true' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NULL;
    END IF;
  END IF;

  -- 2. Allow postgres superuser/admin to bypass
  IF CURRENT_USER = 'postgres' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NULL;
    END IF;
  END IF;

  RAISE EXCEPTION 'Deletion or truncation of the PendingQuestion table is prohibited! To bypass, run: SET myapp.bypass_pending_question_trigger = ''true'';';
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent DELETE statements
CREATE TRIGGER trg_prevent_pending_question_delete
BEFORE DELETE ON "PendingQuestion"
FOR EACH ROW
EXECUTE FUNCTION prevent_pending_question_delete();

-- Create trigger to prevent TRUNCATE statements
CREATE TRIGGER trg_prevent_pending_question_truncate
BEFORE TRUNCATE ON "PendingQuestion"
EXECUTE FUNCTION prevent_pending_question_delete();
