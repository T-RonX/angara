import { Timer } from '@/Renderer/Monitor/Timing/Timer'
import { TimerState } from '@/Renderer/Monitor/Timing/TimerState'

export class Stopwatch {
  private timers: Map<string, Timer> = new Map();

  public create(name: string): Timer {
    const timer: Timer = new Timer()
    this.timers.set(name, timer)

    return timer
  }

  public get(name: string): Timer {
    const timer: Timer|undefined = this.timers.get(name)

    if (timer == undefined) {
      throw new Error(`Timer not found: ${name}`)
    }

    return timer
  }

  public start(name: string): Timer {
    return this.create(name).start()
  }

  public stop(name: string): Timer {
    const timer: Timer|undefined = this.timers.get(name)

    if (timer == undefined) {
      throw new Error(`Timer not found: ${name}`)
    }

    this.timers.get(name)?.stop()

    return timer
  }

  public log(...names: string[]): void {
    const output: (string|number)[] = []

    for (const name of names) {
      const timer: Timer|undefined = this.timers.get(name)

      if (timer == undefined) {
        throw new Error(`Timer not found: ${name}`)
      }

      if (timer.getState() == TimerState.Idle) {
        throw new Error(`Timer not running: ${name}`)
      }

      output.push(`${name}:`)
      output.push(timer.getDuration())
    }

    console.log(...output)
  }
}
