import { TimerState } from '@/Renderer/Monitor/Timing/TimerState'

export class Timer {
  private startTime: number = 0
  private stopTime: number|null = null
  private state: number = TimerState.Idle

  public start(): this {
    this.state = TimerState.Running

    return this.reset()
  }

  public reset(): this {
    this.startTime = performance.now()

    return this
  }

  public stop(): this {
    this.stopTime = performance.now()
    this.state = TimerState.Finished

    return this
  }

  public getDuration(): number {
    return (this.stopTime ?? performance.now()) - this.startTime
  }

  public getState(): TimerState {
    return this.state
  }
}