import { Square } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { useLaunch } from "../store/launch";
import { useInstances } from "../store/instances";

export function StopConfirm() {
  const { confirmKill, cancelKill, confirmKillNow } = useLaunch();
  const instances = useInstances((s) => s.instances);
  const name = instances.find((i) => i.id === confirmKill)?.name ?? "this instance";

  return (
    <Modal
      open={!!confirmKill}
      onClose={cancelKill}
      title="Stop instance"
      footer={
        <>
          <Button variant="ghost" onClick={cancelKill}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmKillNow}>
            <Square size={14} fill="currentColor" />
            Stop
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">
        Force-stop <strong className="text-text">{name}</strong>? The game will
        close immediately and any unsaved progress will be lost.
      </p>
    </Modal>
  );
}
