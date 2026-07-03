import Card from "./Card"
import Stage from "../layout/Stage"

export default function Placeholder({ eyebrow, title, description }) {
  return (
    <Stage eyebrow={eyebrow} title={title} description={description}>
      <Card>
        <p className="text-text-faint text-sm">Em construção — chega numa próxima leva.</p>
      </Card>
    </Stage>
  )
}
