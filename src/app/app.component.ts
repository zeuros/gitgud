import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { invoke } from "@tauri-apps/api/tauri";
import { TabBarComponent } from "./tab-bar/tab-bar.component";
import { from } from "rxjs";
import { ButtonModule } from "primeng/button";

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [CommonModule, RouterOutlet, TabBarComponent, ButtonModule],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent {
    greetingMessage = '';

    greet(name: string): void {
        // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
        from(invoke<string>("greet", {name}))
            .subscribe(text => this.greetingMessage = text);
    }
}
